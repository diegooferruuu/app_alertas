import { TypeOrmModule } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { DenunciasService } from './denuncias.service';
import { Denuncia } from './entities/denuncia.entity';
import { FotografiaDenuncia } from './entities/fotografia-denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from './domain/estados';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { ReputationEvent } from '../users/entities/reputation-event.entity';
import { AlertasService } from '../alertas/alertas.service';
import { PasarelaPush, PasarelaPushSimulada } from '../alertas/pasarela-push';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { EntregaAlerta } from '../alertas/entities/entrega-alerta.entity';
import { Dispositivo } from '../alertas/entities/dispositivo.entity';

/**
 * Pruebas contra Postgres real.
 *
 * Lo que se verifica aquí no se puede verificar con dobles de prueba: que las
 * restricciones de la base rechacen estados incoherentes, que la columna
 * geográfica generada se calcule sola, y que el filtro por `expira_en` proteja
 * la difusión aunque el planificador de caducidad no haya corrido.
 */
describe('DenunciasService (integración)', () => {
  let ctx: ContextoDePruebas;
  let service: DenunciasService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;

  const LA_PAZ = { lat: -16.5, lng: -68.15 };

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          Denuncia,
          FotografiaDenuncia,
          User,
          RefreshToken,
          ReputationEvent,
          EmisionAlerta,
          EntregaAlerta,
          Dispositivo,
        ]),
      ],
      providers: [
        DenunciasService,
        UsersService,
        AlertasService,
        { provide: PasarelaPush, useClass: PasarelaPushSimulada },
      ],
    });
    service = ctx.module.get(DenunciasService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
  });

  afterAll(async () => {
    await ctx.cerrar();
  });

  beforeEach(async () => {
    await ctx.limpiar();
  });

  /** Crea un usuario con documento registrado, que es quien puede denunciar. */
  const crearDenunciante = async (email = 'denunciante@test.com') =>
    usuarios.save(
      usuarios.create({
        full_name: 'Ana Quispe',
        email,
        password_hash: 'x',
        documento_registrado: true,
      }),
    );

  const datosDeDenuncia = {
    nombre_persona_buscada: 'Luis Mamani',
    ci_persona_buscada: '9876543',
    description: 'Visto por última vez el martes en la plaza',
    latitude: LA_PAZ.lat,
    longitude: LA_PAZ.lng,
  };

  describe('creación', () => {
    it('nace REGISTRADA, sin radio ni caducidad: existe pero no se difunde', async () => {
      const autor = await crearDenunciante();

      const denuncia = await service.create(autor.id, datosDeDenuncia);

      expect(denuncia.nivel_confianza).toBe(NivelConfianza.REGISTRADA);
      expect(denuncia.estado).toBe(EstadoDenuncia.ACTIVA);
      expect(denuncia.radio_actual_m).toBeNull();
      expect(denuncia.expira_en).toBeNull();
    });

    it('rechaza a quien no tiene documento registrado', async () => {
      const visitante = await usuarios.save(
        usuarios.create({
          full_name: 'Sin documento',
          email: 'visitante@test.com',
          password_hash: 'x',
          documento_registrado: false,
        }),
      );

      await expect(service.create(visitante.id, datosDeDenuncia)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('guarda el documento de la persona buscada solo como hash', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      const [fila] = await denuncias.query(
        `SELECT ci_hash_persona_buscada AS hash FROM denuncias WHERE id = $1`,
        [id],
      );

      expect(fila.hash).toHaveLength(64);
      expect(fila.hash).not.toContain(datosDeDenuncia.ci_persona_buscada);
    });

    it('no devuelve el hash del documento en la entidad', async () => {
      const autor = await crearDenunciante();
      await service.create(autor.id, datosDeDenuncia);

      const recuperada = await service.findMine(autor.id);

      expect(recuperada[0].ci_hash_persona_buscada).toBeUndefined();
    });

    it('Postgres calcula la ubicación geográfica a partir de las coordenadas', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      const [fila] = await denuncias.query(
        `SELECT ST_AsText(ubicacion::geometry) AS punto FROM denuncias WHERE id = $1`,
        [id],
      );

      expect(fila.punto).toBe(`POINT(${LA_PAZ.lng} ${LA_PAZ.lat})`);
    });
  });

  describe('difusión', () => {
    /** Simula el resultado del acto de firma, que llegará en la fase 2. */
    const difundir = async (id: string, expiraEn: Date) => {
      await denuncias.update(id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: 2000,
        expira_en: expiraEn,
      });
    };

    const dentroDeUnaHora = () => new Date(Date.now() + 3_600_000);
    const haceUnaHora = () => new Date(Date.now() - 3_600_000);

    it('una denuncia REGISTRADA no aparece en la consulta de cercanía', async () => {
      const autor = await crearDenunciante();
      await service.create(autor.id, datosDeDenuncia);

      const cercanas = await service.findNearby(LA_PAZ.lat, LA_PAZ.lng, 5000);

      expect(cercanas).toHaveLength(0);
    });

    it('una denuncia difundida y vigente sí aparece, con su distancia', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await difundir(id, dentroDeUnaHora());

      const cercanas = await service.findNearby(LA_PAZ.lat, LA_PAZ.lng, 5000);

      expect(cercanas).toHaveLength(1);
      expect(cercanas[0].distance_meters).toBe(0);
    });

    it('no aparece si está fuera del radio consultado', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await difundir(id, dentroDeUnaHora());

      // Un grado de latitud son unos 111 km: muy lejos de un radio de 5 km.
      const cercanas = await service.findNearby(LA_PAZ.lat + 1, LA_PAZ.lng, 5000);

      expect(cercanas).toHaveLength(0);
    });

    it('una alerta vencida no se difunde aunque su estado siga ACTIVA', async () => {
      // Este es el caso que justifica tener dos garantías de caducidad: aquí el
      // planificador no ha corrido, así que la fila sigue marcada como activa.
      // El filtro por expira_en es lo único que impide difundirla.
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await difundir(id, haceUnaHora());

      const [fila] = await denuncias.query(
        `SELECT estado FROM denuncias WHERE id = $1`,
        [id],
      );
      expect(fila.estado).toBe(EstadoDenuncia.ACTIVA);

      const cercanas = await service.findNearby(LA_PAZ.lat, LA_PAZ.lng, 5000);
      expect(cercanas).toHaveLength(0);
    });

    it('su autor sigue viéndola aunque no se difunda', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await difundir(id, haceUnaHora());

      const mias = await service.findMine(autor.id);

      expect(mias).toHaveLength(1);
    });
  });

  describe('caducidad', () => {
    it('marca las vencidas y conserva hasta dónde y hasta cuándo se difundieron', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await denuncias.update(id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() - 3_600_000),
      });

      const caducadas = await service.caducarVencidas();

      expect(caducadas).toBe(1);
      const despues = await service.findOne(id);
      expect(despues.estado).toBe(EstadoDenuncia.CADUCADA);
      // Muere la alerta, no el caso: no se borra información.
      expect(despues.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
      expect(despues.radio_actual_m).toBe(2000);
    });

    it('no toca las que siguen vigentes', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await denuncias.update(id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 3_600_000),
      });

      expect(await service.caducarVencidas()).toBe(0);
    });

    it('no toca una REGISTRADA, que nunca llegó a difundirse', async () => {
      const autor = await crearDenunciante();
      await service.create(autor.id, datosDeDenuncia);

      expect(await service.caducarVencidas()).toBe(0);
    });
  });

  describe('edición', () => {
    it('permite corregir mientras la denuncia siga REGISTRADA', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      const editada = await service.update(autor.id, id, {
        description: 'Corrijo: fue el miércoles',
      });

      expect(editada.description).toBe('Corrijo: fue el miércoles');
    });

    it('cierra la edición una vez declarada bajo juramento', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await denuncias.update(id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 3_600_000),
      });

      await expect(
        service.update(autor.id, id, { description: 'Contenido ya sellado' }),
      ).rejects.toThrow(ConflictException);
    });

    it('impide editar la denuncia de otra persona', async () => {
      const autor = await crearDenunciante();
      const ajeno = await crearDenunciante('ajeno@test.com');
      const { id } = await service.create(autor.id, datosDeDenuncia);

      await expect(
        service.update(ajeno.id, id, { description: 'No es mía' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('fotografías', () => {
    const UNA_IMAGEN = Buffer.from('contenido-de-imagen').toString('base64');

    it('guarda la fotografía en su propia tabla, no en la fila de la denuncia', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, {
        ...datosDeDenuncia,
        fotografia_base64: UNA_IMAGEN,
      });

      const columnas = await denuncias.query(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'denuncias' AND column_name = 'photo_base64'`,
      );
      expect(columnas).toHaveLength(0);

      const fotos = await service.fotografiasDe(id);
      expect(fotos).toHaveLength(1);
      expect(fotos[0].contenido).toBe(UNA_IMAGEN);
    });

    it('la consulta de cercanía no arrastra el contenido de las imágenes', async () => {
      // Es la razón de ser de esta tabla: la consulta de proximidad es la ruta
      // crítica del sistema y no puede cargar cientos de kilobytes por fila.
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, {
        ...datosDeDenuncia,
        fotografia_base64: UNA_IMAGEN,
      });
      await denuncias.update(id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 3_600_000),
      });

      const cercanas = await service.findNearby(LA_PAZ.lat, LA_PAZ.lng, 5000);

      expect(cercanas).toHaveLength(1);
      expect(JSON.stringify(cercanas)).not.toContain(UNA_IMAGEN);
    });

    it('«mis denuncias» tampoco arrastra el contenido', async () => {
      const autor = await crearDenunciante();
      await service.create(autor.id, {
        ...datosDeDenuncia,
        fotografia_base64: UNA_IMAGEN,
      });

      const mias = await service.findMine(autor.id);

      expect(JSON.stringify(mias)).not.toContain(UNA_IMAGEN);
    });

    it('reemplaza la imagen al editar, sin dejar la anterior huérfana', async () => {
      const OTRA = Buffer.from('imagen-corregida').toString('base64');
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, {
        ...datosDeDenuncia,
        fotografia_base64: UNA_IMAGEN,
      });

      await service.update(autor.id, id, { fotografia_base64: OTRA });

      const fotos = await service.fotografiasDe(id);
      expect(fotos).toHaveLength(1);
      expect(fotos[0].contenido).toBe(OTRA);
    });

    it('borrar la denuncia se lleva sus fotografías', async () => {
      // No hay ruta que borre denuncias (invariante I7), pero la cascada debe
      // existir igual: si un usuario se elimina, su denuncia cae con él y las
      // imágenes no pueden quedar sueltas.
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, {
        ...datosDeDenuncia,
        fotografia_base64: UNA_IMAGEN,
      });

      await denuncias.delete(id);

      const [{ count }] = await denuncias.query(
        `SELECT COUNT(*)::int AS count FROM fotografias_denuncia WHERE denuncia_id = $1`,
        [id],
      );
      expect(count).toBe(0);
    });
  });

  describe('restricciones de la base', () => {
    it('rechaza una denuncia difundible sin plazo de caducidad', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      // Una alerta emitida sin vencimiento sería inmortal: se difundiría para
      // siempre sin corroboración y sin que la caducidad pueda alcanzarla.
      await expect(
        denuncias.query(
          `UPDATE denuncias SET nivel_confianza = 'PROVISIONAL', radio_actual_m = 2000 WHERE id = $1`,
          [id],
        ),
      ).rejects.toThrow(/chk_denuncias_difusion_coherente/);
    });

    it('rechaza un nivel de confianza que el código no sabe interpretar', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      // Se acompañan radio y plazo para no violar de paso la restricción de
      // coherencia: así el único motivo posible de rechazo es el valor inválido.
      await expect(
        denuncias.query(
          `UPDATE denuncias
             SET nivel_confianza = 'INVENTADO',
                 radio_actual_m = 2000,
                 expira_en = now() + interval '1 day'
           WHERE id = $1`,
          [id],
        ),
      ).rejects.toThrow(/chk_denuncias_nivel_confianza/);
    });

    it('rechaza un estado que el código no sabe interpretar', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      await expect(
        denuncias.query(`UPDATE denuncias SET estado = 'INVENTADO' WHERE id = $1`, [
          id,
        ]),
      ).rejects.toThrow(/chk_denuncias_estado/);
    });
  });

  /**
   * H4.1 — Aviso a la persona que la denuncia identifica.
   * H4.2 — Y que el denunciante no pueda notar la diferencia (invariante I5).
   */
  describe('aviso por coincidencia de documento', () => {
    const CI_REPORTADO = '5544332';
    const hashDe = (ci: string) =>
      createHash('sha256').update(ci.trim()).digest('hex');

    const datosConCi = (ci: string) => ({ ...datosDeDenuncia, ci_persona_buscada: ci });

    /** Alguien con cuenta cuyo documento coincide con el reportado. */
    const crearPersonaReportada = async () =>
      usuarios.save(
        usuarios.create({
          full_name: 'Luis Mamani',
          email: 'reportado@test.com',
          password_hash: 'x',
          documento_registrado: true,
          ci_hash: hashDe(CI_REPORTADO),
        }),
      );

    it('encola un aviso directo cuando la persona reportada tiene cuenta', async () => {
      const autor = await crearDenunciante();
      const reportado = await crearPersonaReportada();

      const denuncia = await service.create(autor.id, datosConCi(CI_REPORTADO));

      const emisiones = await denuncias.manager.find(EmisionAlerta, {
        where: { denuncia_id: denuncia.id },
      });
      expect(emisiones).toHaveLength(1);
      expect(emisiones[0].motivo).toBe('coincidencia_documento');
      expect(emisiones[0].usuario_objetivo_id).toBe(reportado.id);
      // Un aviso personal no tiene zona que alcanzar.
      expect(emisiones[0].radio_m).toBeNull();
    });

    it('no encola nada si la persona reportada no tiene cuenta', async () => {
      const autor = await crearDenunciante();

      const denuncia = await service.create(autor.id, datosConCi('1111111'));

      expect(
        await denuncias.manager.count(EmisionAlerta, {
          where: { denuncia_id: denuncia.id },
        }),
      ).toBe(0);
    });

    it('avisa al crear, sin esperar a que la denuncia se difunda', async () => {
      // Quien es reportado tiene derecho a enterarse antes de que nada salga a
      // la zona. La denuncia sigue en REGISTRADA y el aviso ya está encolado.
      const autor = await crearDenunciante();
      await crearPersonaReportada();

      const denuncia = await service.create(autor.id, datosConCi(CI_REPORTADO));

      expect(denuncia.nivel_confianza).toBe(NivelConfianza.REGISTRADA);
      expect(
        await denuncias.manager.count(EmisionAlerta, {
          where: { denuncia_id: denuncia.id },
        }),
      ).toBe(1);
    });

    it('la respuesta es indistinguible haya coincidencia o no', async () => {
      // Invariante I5. Si el denunciante pudiera deducir que la persona tiene
      // cuenta, el sistema se habría convertido en un buscador de documentos:
      // bastaría probar números de carnet y observar la diferencia.
      const autor = await crearDenunciante();
      await crearPersonaReportada();

      const conCoincidencia = await service.create(
        autor.id,
        datosConCi(CI_REPORTADO),
      );
      const sinCoincidencia = await service.create(autor.id, datosConCi('1111111'));

      const forma = (d: typeof conCoincidencia) =>
        Object.keys(d as object).sort();

      expect(forma(conCoincidencia)).toEqual(forma(sinCoincidencia));
      expect(conCoincidencia.nivel_confianza).toBe(sinCoincidencia.nivel_confianza);
      expect(conCoincidencia.estado).toBe(sinCoincidencia.estado);
      expect(conCoincidencia.radio_actual_m).toBe(sinCoincidencia.radio_actual_m);
      // Y sobre todo: nada en la respuesta menciona la coincidencia.
      expect(JSON.stringify(conCoincidencia)).not.toContain('usuario_objetivo');
      expect(JSON.stringify(conCoincidencia)).not.toContain('coincidencia');
    });

    it('la columna geográfica generada no viaja en la respuesta', async () => {
      // Se deriva de las coordenadas, así que no es información nueva, pero es
      // ruido binario en cada respuesta y la entidad la marca `select: false`.
      const autor = await crearDenunciante();

      const denuncia = await service.create(autor.id, datosDeDenuncia);

      expect(denuncia.ubicacion).toBeUndefined();
    });

    it('el hash del documento reportado tampoco viaja en la respuesta', async () => {
      const autor = await crearDenunciante();
      await crearPersonaReportada();

      const denuncia = await service.create(autor.id, datosConCi(CI_REPORTADO));

      expect(JSON.stringify(denuncia)).not.toContain(hashDe(CI_REPORTADO));
      expect(JSON.stringify(denuncia)).not.toContain(CI_REPORTADO);
    });
  });
});
