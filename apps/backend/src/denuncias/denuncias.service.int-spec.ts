import { TypeOrmModule } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { getRepositoryToken } from '@nestjs/typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { DenunciasService } from './denuncias.service';
import { CreateDenunciaDto } from './dto/create-denuncia.dto';
import { Denuncia } from './entities/denuncia.entity';
import { FotografiaDenuncia } from './entities/fotografia-denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from './domain/estados';
import { aZonaDeAvistamiento } from './domain/zona-avistamiento';
import { EstadoCuenta } from '../users/domain/estado-cuenta';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { SancionesService } from '../sanciones/sanciones.service';
import { Falta } from '../sanciones/entities/falta.entity';
import { Cierre, TipoCierre } from '../cierres/entities/cierre.entity';
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
          Falta,
          Cierre,
          EmisionAlerta,
          EntregaAlerta,
          Dispositivo,
        ]),
      ],
      providers: [
        DenunciasService,
        UsersService,
        SancionesService,
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

  /**
   * Crea un usuario con documento registrado, que es quien puede denunciar.
   *
   * El hash se deriva del correo y no de un número fijo: cada denunciante de la
   * suite necesita el suyo —la columna es única— y así ninguno coincide por
   * accidente con el documento de una persona reportada.
   */
  const crearDenunciante = async (email = 'denunciante@test.com') =>
    usuarios.save(
      usuarios.create({
        full_name: 'Ana Quispe',
        email,
        password_hash: 'x',
        documento_registrado: true,
        ci_hash: createHash('sha256').update(email).digest('hex'),
      }),
    );

  /**
   * Una denuncia completa según el formulario de campos cerrados.
   *
   * No lleva `description`: el relato libre se retiró y el DTO lo rechaza. La
   * fotografía es obligatoria, así que va un base64 mínimo pero válido.
   */
  const datosDeDenuncia: CreateDenunciaDto = {
    nombre_persona_buscada: 'Luis Mamani',
    ci_persona_buscada: '9876543',
    fecha_nacimiento: '1990-04-12',
    sexo: 'MASCULINO',
    estatura_rango: 'DE_170_A_180',
    contextura: 'MEDIA',
    color_piel: 'TRIGUENA',
    color_cabello: 'NEGRO',
    color_ojos: 'CAFES_OSCUROS',
    senas_particulares: ['CICATRIZ'],
    ultimo_avistamiento_en: '2026-01-15T14:30:00.000Z',
    prenda_superior: 'CHOMPA',
    color_prenda_superior: 'AZUL',
    prenda_inferior: 'PANTALON_JEAN',
    color_prenda_inferior: 'NEGRO',
    calzado: 'ZAPATILLAS',
    circunstancia: 'SALIO_DE_CASA',
    condicion_relevante: ['REQUIERE_MEDICACION'],
    latitude: LA_PAZ.lat,
    longitude: LA_PAZ.lng,
    fotografia_base64: 'Zm90bw==',
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

    /**
     * P6. El número de documento de la persona buscada no se almacena en claro
     * en ningún punto del sistema, incluidos registros de log y respuestas de la
     * API.
     *
     * Se comprueba sobre la fila entera y sobre todo lo que el servicio emite,
     * y no solo sobre la columna que se sabe que lo guarda en hash: el riesgo
     * real no es la columna prevista, es la que alguien añada mañana.
     */
    it('P6 · el documento no queda en claro en ninguna columna ni en los registros', async () => {
      const CI_RASTREABLE = '77713579';
      const espias = [
        jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {}),
        jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => {}),
        jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {}),
        jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {}),
        jest.spyOn(Logger.prototype, 'verbose').mockImplementation(() => {}),
      ];

      try {
        const autor = await crearDenunciante();
        const devuelta = await service.create(autor.id, {
          ...datosDeDenuncia,
          ci_persona_buscada: CI_RASTREABLE,
        });

        // 1. Ninguna columna de la fila, sea cual sea, contiene el número.
        const [fila] = await denuncias.query(
          `SELECT to_jsonb(d)::text AS todo FROM denuncias d WHERE id = $1`,
          [devuelta.id],
        );
        expect(fila.todo).not.toContain(CI_RASTREABLE);

        // 2. Tampoco lo que el servicio devuelve, que es lo que sale por la API.
        expect(JSON.stringify(devuelta)).not.toContain(CI_RASTREABLE);
        const listada = await service.findMine(autor.id);
        expect(JSON.stringify(listada)).not.toContain(CI_RASTREABLE);

        // 3. Ni una sola línea de registro lo menciona.
        const escrito = espias
          .flatMap((espia) => espia.mock.calls)
          .flat()
          .map((argumento) => String(argumento))
          .join(' ');
        expect(escrito).not.toContain(CI_RASTREABLE);

        // Y el hash sí está: lo que se guarda es la huella, no nada.
        const [conHash] = await denuncias.query(
          `SELECT ci_hash_persona_buscada AS hash FROM denuncias WHERE id = $1`,
          [devuelta.id],
        );
        expect(conHash.hash).toBe(
          createHash('sha256').update(CI_RASTREABLE).digest('hex'),
        );
      } finally {
        espias.forEach((espia) => espia.mockRestore());
      }
    });

    it('rechaza un último avistamiento en el futuro', async () => {
      const autor = await crearDenunciante();

      await expect(
        service.create(autor.id, {
          ...datosDeDenuncia,
          ultimo_avistamiento_en: new Date(Date.now() + 86_400_000).toISOString(),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('guarda los valores múltiples ordenados y sin repetidos', async () => {
      // De esto depende el sellado: el mismo conjunto en distinto orden tiene
      // que producir el mismo hash de contenido.
      const autor = await crearDenunciante();

      const denuncia = await service.create(autor.id, {
        ...datosDeDenuncia,
        senas_particulares: ['TATUAJE', 'CICATRIZ', 'TATUAJE'],
      });

      expect(denuncia.senas_particulares).toEqual(['CICATRIZ', 'TATUAJE']);
    });

    it('la base rechaza un valor fuera del dominio aunque se escriba directo', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      await expect(
        denuncias.query(
          `UPDATE denuncias SET prenda_superior = 'PONCHO' WHERE id = $1`,
          [id],
        ),
      ).rejects.toThrow(/chk_denuncias_prenda_superior/);
    });

    it('la base impide nacer después de haber sido visto por última vez', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      await expect(
        denuncias.query(
          `UPDATE denuncias SET fecha_nacimiento = '2030-01-01' WHERE id = $1`,
          [id],
        ),
      ).rejects.toThrow(/chk_denuncias_nacimiento_antes_de_avistamiento/);
    });

    it('se sella con la fórmula que no incluye el relato libre', async () => {
      const autor = await crearDenunciante();
      const denuncia = await service.create(autor.id, datosDeDenuncia);

      expect(denuncia.version_formula_contenido).toBe(2);
      expect(denuncia.description).toBeNull();
    });

    it('Postgres calcula la ubicación geográfica a partir de las coordenadas', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      const [fila] = await denuncias.query(
        `SELECT ST_AsText(ubicacion::geometry) AS punto FROM denuncias WHERE id = $1`,
        [id],
      );

      // La columna generada refleja lo que quedó guardado, que es la zona
      // reducida y no el punto que se envió.
      const zona = aZonaDeAvistamiento({
        latitude: LA_PAZ.lat,
        longitude: LA_PAZ.lng,
      });
      expect(fila.punto).toBe(`POINT(${zona.longitude} ${zona.latitude})`);
    });

    it('P·ubicación · no guarda el punto exacto que se envió', async () => {
      // El invariante: la ubicación exacta de un avistamiento no debe existir en
      // la base. Se comprueba sobre la fila, no sobre lo que devuelve el
      // servicio: lo que importa es qué quedó escrito.
      const autor = await crearDenunciante();
      const exacto = { lat: -16.4957123, lng: -68.1335456 };

      const { id } = await service.create(autor.id, {
        ...datosDeDenuncia,
        latitude: exacto.lat,
        longitude: exacto.lng,
      });

      const [fila] = await denuncias.query(
        `SELECT latitude, longitude FROM denuncias WHERE id = $1`,
        [id],
      );

      expect(Number(fila.latitude)).not.toBe(exacto.lat);
      expect(Number(fila.longitude)).not.toBe(exacto.lng);

      // Y sigue estando cerca: reducir no puede mandar la alerta a otra ciudad.
      expect(Math.abs(Number(fila.latitude) - exacto.lat)).toBeLessThan(0.01);
      expect(Math.abs(Number(fila.longitude) - exacto.lng)).toBeLessThan(0.01);
    });

    it('P·ubicación · dos denuncias de la misma manzana quedan en la misma zona', async () => {
      const autor = await crearDenunciante();
      const otro = await crearDenunciante('otro@test.com');

      const { id: a } = await service.create(autor.id, {
        ...datosDeDenuncia,
        latitude: -16.4957,
        longitude: -68.1335,
      });
      const { id: b } = await service.create(otro.id, {
        ...datosDeDenuncia,
        ci_persona_buscada: '1234567',
        latitude: -16.4959,
        longitude: -68.1337,
      });

      const filas = await denuncias.query(
        `SELECT latitude, longitude FROM denuncias WHERE id = ANY($1)`,
        [[a, b]],
      );

      expect(Number(filas[0].latitude)).toBe(Number(filas[1].latitude));
      expect(Number(filas[0].longitude)).toBe(Number(filas[1].longitude));
    });
  });

  describe('régimen de sanciones al denunciar', () => {
    const hashDe = (ci: string) => createHash('sha256').update(ci.trim()).digest('hex');

    /** Ejecuta la creación esperando un rechazo, y lo devuelve para revisarlo. */
    const rechazoDe = async (promesa: Promise<unknown>): Promise<HttpException> => {
      try {
        await promesa;
      } catch (error) {
        return error as HttpException;
      }
      throw new Error('Se esperaba que la creación se rechazara');
    };

    /**
     * Deja cerrada una denuncia del autor, como la dejaría la persona reportada.
     *
     * Se escribe la fila directamente: cómo se llega a ella lo prueba la suite de
     * cierres; aquí importa qué permite después.
     */
    const cerrar = async (
      autor: User,
      denunciaId: string,
      tipo: TipoCierre,
      bloquea: boolean,
    ) => {
      await denuncias.update(denunciaId, { estado: EstadoDenuncia.INVALIDADA });
      await denuncias.manager.insert(Cierre, {
        denuncia_id: denunciaId,
        ci_hash_denunciante: autor.ci_hash!,
        ci_hash_persona_buscada: hashDe(datosDeDenuncia.ci_persona_buscada),
        tipo_cierre: tipo,
        bloquea_nueva_denuncia: bloquea,
      });
    };

    it('una cuenta suspendida no denuncia, y el rechazo trae su código', async () => {
      const autor = await crearDenunciante();
      await usuarios.update(autor.id, { estado_cuenta: EstadoCuenta.SUSPENDIDA });

      const rechazo = await rechazoDe(service.create(autor.id, datosDeDenuncia));

      expect(rechazo).toBeInstanceOf(ForbiddenException);
      expect(rechazo.getResponse()).toMatchObject({ codigo: 'CUENTA_SUSPENDIDA' });
    });

    it('una falta no quita la facultad de denunciar (I9)', async () => {
      // Lo que restringe es la difusión: firmar le exigirá el caso de la FELCC.
      const autor = await crearDenunciante();
      const anterior = await service.create(autor.id, {
        ...datosDeDenuncia,
        ci_persona_buscada: '1111111',
      });
      await denuncias.update(anterior.id, { estado: EstadoDenuncia.INVALIDADA });
      await denuncias.manager.insert(Falta, {
        usuario_id: autor.id,
        tipo: 'CIERRE_CON_SANCION',
        denuncia_id: anterior.id,
      });

      const nueva = await service.create(autor.id, datosDeDenuncia);

      expect(nueva.nivel_confianza).toBe(NivelConfianza.REGISTRADA);
    });

    it('no admite una segunda denuncia abierta sobre la misma persona', async () => {
      const autor = await crearDenunciante();
      await service.create(autor.id, datosDeDenuncia);

      const rechazo = await rechazoDe(service.create(autor.id, datosDeDenuncia));

      expect(rechazo).toBeInstanceOf(ConflictException);
      expect(rechazo.getResponse()).toMatchObject({
        codigo: 'DENUNCIA_ABIERTA_SOBRE_PERSONA',
      });
      expect(await denuncias.count()).toBe(1);
    });

    it('una caducada sigue abierta: tampoco admite otra encima', async () => {
      // El camino para volver a difundirla es el caso de la FELCC, no duplicarla.
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await denuncias.update(id, { estado: EstadoDenuncia.CADUCADA });

      const rechazo = await rechazoDe(service.create(autor.id, datosDeDenuncia));

      expect(rechazo.getResponse()).toMatchObject({
        codigo: 'DENUNCIA_ABIERTA_SOBRE_PERSONA',
      });
    });

    it('la regla es de cada denunciante: otra persona sí puede denunciar a la misma', async () => {
      // Si fuera de todo el sistema, el rechazo revelaría que alguien ya la
      // denunció: bastaría probar documentos para saber a quién se busca.
      const autor = await crearDenunciante();
      const vecina = await crearDenunciante('vecina@test.com');
      await service.create(autor.id, datosDeDenuncia);

      await expect(service.create(vecina.id, datosDeDenuncia)).resolves.toBeDefined();
    });

    it('cerrada con «Estoy bien» sin bloqueo, se puede volver a denunciar', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await cerrar(autor, id, TipoCierre.SIN_SANCION, false);

      const nueva = await service.create(autor.id, datosDeDenuncia);

      expect(nueva.id).not.toBe(id);
    });

    it('el bloqueo no revela qué cierre eligió la persona', async () => {
      // «Estoy bien» con bloqueo y «Es falsa» rechazan con la misma respuesta:
      // si fueran distintas, el rechazo delataría cuál de los dos se eligió.
      const porEstoyBien = await crearDenunciante('uno@test.com');
      const porFalsa = await crearDenunciante('dos@test.com');
      const primera = await service.create(porEstoyBien.id, datosDeDenuncia);
      const segunda = await service.create(porFalsa.id, datosDeDenuncia);
      await cerrar(porEstoyBien, primera.id, TipoCierre.SIN_SANCION, true);
      await cerrar(porFalsa, segunda.id, TipoCierre.CON_SANCION, true);

      const rechazoA = await rechazoDe(service.create(porEstoyBien.id, datosDeDenuncia));
      const rechazoB = await rechazoDe(service.create(porFalsa.id, datosDeDenuncia));

      expect(rechazoA.getResponse()).toMatchObject({
        codigo: 'DENUNCIA_SOBRE_PERSONA_BLOQUEADA',
      });
      expect(rechazoA.getStatus()).toBe(rechazoB.getStatus());
      expect(rechazoA.getResponse()).toEqual(rechazoB.getResponse());
    });

    it('dos envíos simultáneos: uno se registra y el otro recibe el 409', async () => {
      // La comprobación previa no alcanza: las dos peticiones pueden pasarla
      // antes de que ninguna inserte. Lo garantiza el índice único de la base.
      const autor = await crearDenunciante();

      const resultados = await Promise.allSettled([
        service.create(autor.id, datosDeDenuncia),
        service.create(autor.id, datosDeDenuncia),
      ]);

      const rechazos = resultados.filter(
        (r): r is PromiseRejectedResult => r.status === 'rejected',
      );
      expect(rechazos).toHaveLength(1);
      expect(rechazos[0].reason).toBeInstanceOf(ConflictException);
      expect(rechazos[0].reason.getResponse()).toMatchObject({
        codigo: 'DENUNCIA_ABIERTA_SOBRE_PERSONA',
      });
      expect(await denuncias.count()).toBe(1);
    });
  });

  describe('«La encontramos»', () => {
    /** Una denuncia firmada y difundiéndose, con una emisión todavía pendiente. */
    const difundidaConPendiente = async (autorId: string) => {
      const { id } = await service.create(autorId, datosDeDenuncia);
      await denuncias.update(id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 3_600_000),
      });
      await denuncias.manager.insert(EmisionAlerta, { denuncia_id: id, radio_m: 2000, motivo: 'firma' });
      return id;
    };

    it('quien la presentó la da por terminada: deja de difundirse y queda la fecha', async () => {
      const autor = await crearDenunciante();
      const id = await difundidaConPendiente(autor.id);

      const { denuncia, mensaje } = await service.darPorEncontrada(autor.id, id);

      expect(denuncia.estado).toBe(EstadoDenuncia.CERRADA);
      expect(denuncia.cerrada_en).toBeInstanceOf(Date);
      expect(mensaje).toContain('dejó de difundirse');
      expect(await service.findNearby(LA_PAZ.lat, LA_PAZ.lng, 5000)).toHaveLength(0);
    });

    it('revoca lo que todavía no salió', async () => {
      const autor = await crearDenunciante();
      const id = await difundidaConPendiente(autor.id);

      await service.darPorEncontrada(autor.id, id);

      const [emision] = await denuncias.manager.find(EmisionAlerta, { where: { denuncia_id: id } });
      expect(emision.estado).toBe('completada');
      expect(emision.destinatarios).toBe(0);
      expect(emision.ultimo_error).toMatch(/^revocada/);
    });

    it('nadie más puede hacerlo, y para los demás es como si no existiera', async () => {
      const autor = await crearDenunciante();
      const vecina = await crearDenunciante('vecina@test.com');
      const id = await difundidaConPendiente(autor.id);

      await expect(service.darPorEncontrada(vecina.id, id)).rejects.toThrow(NotFoundException);
      expect((await service.findOne(id)).estado).toBe(EstadoDenuncia.ACTIVA);
    });

    it('no se puede cerrar dos veces ni reabrir', async () => {
      const autor = await crearDenunciante();
      const id = await difundidaConPendiente(autor.id);
      await service.darPorEncontrada(autor.id, id);

      await expect(service.darPorEncontrada(autor.id, id)).rejects.toThrow(ConflictException);
      // Ni la caducidad la alcanza: solo toca las ACTIVAS.
      expect(await service.caducarVencidas()).toBe(0);
    });

    it('no pisa el cierre de la persona reportada', async () => {
      const autor = await crearDenunciante();
      const id = await difundidaConPendiente(autor.id);
      await denuncias.update(id, { estado: EstadoDenuncia.INVALIDADA });

      await expect(service.darPorEncontrada(autor.id, id)).rejects.toThrow(
        /La persona reportada ya cerró esta alerta/,
      );
    });

    it('también una vencida', async () => {
      const autor = await crearDenunciante();
      const id = await difundidaConPendiente(autor.id);
      await denuncias.update(id, { estado: EstadoDenuncia.CADUCADA });

      const { denuncia } = await service.darPorEncontrada(autor.id, id);

      expect(denuncia.estado).toBe(EstadoDenuncia.CERRADA);
    });

    it('una sin firmar también, y libera para volver a denunciar si vuelve a desaparecer', async () => {
      // Sin esto, la denuncia vieja seguiría «abierta» y bloquearía la nueva.
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      const { mensaje } = await service.darPorEncontrada(autor.id, id);

      expect(mensaje).toContain('No llegó a difundirse');
      await expect(service.create(autor.id, datosDeDenuncia)).resolves.toBeDefined();
    });

    it('la base exige la fecha en una cerrada, y solo en ella', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);

      await expect(
        denuncias.query(`UPDATE denuncias SET estado = 'CERRADA' WHERE id = $1`, [id]),
      ).rejects.toThrow(/chk_denuncias_cerrada_con_fecha/);
      await expect(
        denuncias.query(`UPDATE denuncias SET cerrada_en = now() WHERE id = $1`, [id]),
      ).rejects.toThrow(/chk_denuncias_cerrada_con_fecha/);
    });
  });

  describe('quién ve el detalle', () => {
    /** Una denuncia del autor, ya firmada y difundiéndose. */
    const difundida = async (autorId: string) => {
      const { id } = await service.create(autorId, datosDeDenuncia);
      await denuncias.update(id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 3_600_000),
      });
      return id;
    };

    it('quien la presentó la ve siempre, aunque nadie más pueda', async () => {
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await denuncias.update(id, { estado: EstadoDenuncia.INVALIDADA });

      await expect(service.findVisiblePara(autor.id, id)).resolves.toMatchObject({ id });
    });

    it('una sin firmar solo la ve su autor', async () => {
      // «Por ahora solo tú la ves» tiene que ser cierto también para quien
      // consiga el identificador.
      const autor = await crearDenunciante();
      const vecina = await crearDenunciante('vecina@test.com');
      const { id } = await service.create(autor.id, datosDeDenuncia);

      await expect(service.findVisiblePara(vecina.id, id)).rejects.toThrow(NotFoundException);
    });

    it('una difundida la ve cualquiera', async () => {
      const autor = await crearDenunciante();
      const vecina = await crearDenunciante('vecina@test.com');
      const id = await difundida(autor.id);

      await expect(service.findVisiblePara(vecina.id, id)).resolves.toMatchObject({ id });
    });

    it('una vencida se sigue viendo desde la notificación que ya se recibió', async () => {
      // No está en el mapa, pero quien recibió la alerta puede ver hoy a la
      // persona y necesita sus datos para avisar a la Policía.
      const autor = await crearDenunciante();
      const vecina = await crearDenunciante('vecina@test.com');
      const id = await difundida(autor.id);
      await denuncias.update(id, { estado: EstadoDenuncia.CADUCADA });

      await expect(service.findVisiblePara(vecina.id, id)).resolves.toMatchObject({ id });
    });

    it('una que la persona reportada cerró ya no la ven los vecinos', async () => {
      // Seguir mostrándola expondría su foto después de que pidió detenerla.
      const autor = await crearDenunciante();
      const vecina = await crearDenunciante('vecina@test.com');
      const id = await difundida(autor.id);
      await denuncias.update(id, { estado: EstadoDenuncia.INVALIDADA });

      await expect(service.findVisiblePara(vecina.id, id)).rejects.toThrow(NotFoundException);
    });

    it('una oculta responde igual que una que no existe', async () => {
      const autor = await crearDenunciante();
      const vecina = await crearDenunciante('vecina@test.com');
      const { id } = await service.create(autor.id, datosDeDenuncia);

      const oculta = await service.findVisiblePara(vecina.id, id).catch((e) => e);
      const inexistente = await service
        .findVisiblePara(vecina.id, '00000000-0000-4000-8000-000000000000')
        .catch((e) => e);

      expect(oculta.getStatus()).toBe(inexistente.getStatus());
      expect(oculta.getResponse()).toEqual(inexistente.getResponse());
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
      // Ya no es exactamente cero: lo guardado es el centro de la celda de ~1 km
      // que contiene el punto. La reducción no puede sacar la denuncia del radio.
      expect(cercanas[0].distance_meters).toBeLessThan(1000);
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
        prenda_superior: 'CASACA',
        color_prenda_superior: 'ROJO',
      });

      expect(editada.prenda_superior).toBe('CASACA');
      expect(editada.color_prenda_superior).toBe('ROJO');
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
        service.update(autor.id, id, { prenda_superior: 'CAMISA' }),
      ).rejects.toThrow(ConflictException);
    });

    it('una cerrada ya no se edita, aunque nadie la haya firmado', async () => {
      // Sin firma no hay sellado, pero cambiarla después alteraría lo que la
      // persona reportada vio cuando la cerró.
      const autor = await crearDenunciante();
      const { id } = await service.create(autor.id, datosDeDenuncia);
      await denuncias.update(id, { estado: EstadoDenuncia.INVALIDADA });

      await expect(
        service.update(autor.id, id, { prenda_superior: 'CAMISA' }),
      ).rejects.toThrow(/cerrada ya no se puede editar/);
    });

    it('impide editar la denuncia de otra persona', async () => {
      const autor = await crearDenunciante();
      const ajeno = await crearDenunciante('ajeno@test.com');
      const { id } = await service.create(autor.id, datosDeDenuncia);

      await expect(
        service.update(ajeno.id, id, { prenda_superior: 'CAMISA' }),
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

    /**
     * La alerta de un menor de edad no lleva fotografía.
     *
     * Se comprueba en el servidor y no en la pantalla porque la pantalla corre
     * en un teléfono ajeno: una aplicación modificada manda el campo igual, y
     * una regla que solo vive en el cliente es una sugerencia.
     */
    describe('menores de edad', () => {
      /** Nace hace diez años, contados desde la ejecución de la prueba. */
      const DE_UN_MENOR = new Date(
        new Date().getFullYear() - 10,
        3,
        4,
      )
        .toISOString()
        .slice(0, 10);

      const datosDeMenor = {
        ...datosDeDenuncia,
        fecha_nacimiento: DE_UN_MENOR,
        // El avistamiento no puede ser anterior al nacimiento (hay un CHECK).
        ultimo_avistamiento_en: new Date(Date.now() - 3_600_000).toISOString(),
      };

      it('rechaza la denuncia de un menor que trae fotografía', async () => {
        const autor = await crearDenunciante();

        await expect(
          service.create(autor.id, {
            ...datosDeMenor,
            fotografia_base64: UNA_IMAGEN,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('acepta la denuncia de un menor sin fotografía', async () => {
        const autor = await crearDenunciante();

        const { id } = await service.create(autor.id, {
          ...datosDeMenor,
          fotografia_base64: undefined,
        });

        expect(await service.fotografiasDe(id)).toHaveLength(0);
      });

      it('sigue exigiendo fotografía a quien no es menor', async () => {
        // La foto dejó de ser obligatoria en el DTO para permitir el caso del
        // menor. Sin esta comprobación, omitirla sería la forma de crear
        // cualquier denuncia sin retrato.
        const autor = await crearDenunciante();

        await expect(
          service.create(autor.id, {
            ...datosDeDenuncia,
            fotografia_base64: undefined,
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('corregir la fecha a la de un menor retira la fotografía ya guardada', async () => {
        // La vía de evasión evidente: crear con fecha de adulto y foto, y
        // corregir la fecha después. La imagen ya estaría en la base.
        const autor = await crearDenunciante();
        const { id } = await service.create(autor.id, {
          ...datosDeDenuncia,
          fotografia_base64: UNA_IMAGEN,
        });
        expect(await service.fotografiasDe(id)).toHaveLength(1);

        await service.update(autor.id, id, { fecha_nacimiento: DE_UN_MENOR });

        expect(await service.fotografiasDe(id)).toHaveLength(0);
      });

      it('no deja adjuntar una fotografía a una denuncia ya marcada como de menor', async () => {
        const autor = await crearDenunciante();
        const { id } = await service.create(autor.id, {
          ...datosDeMenor,
          fotografia_base64: undefined,
        });

        await expect(
          service.update(autor.id, id, { fotografia_base64: UNA_IMAGEN }),
        ).rejects.toThrow(BadRequestException);

        expect(await service.fotografiasDe(id)).toHaveLength(0);
      });

      it('corregir la fecha a la de un adulto vuelve a permitir fotografía', async () => {
        // La regla protege por edad, no castiga: una fecha mal tecleada que se
        // corrige devuelve el caso a la normalidad.
        const autor = await crearDenunciante();
        const { id } = await service.create(autor.id, {
          ...datosDeMenor,
          fotografia_base64: undefined,
        });

        await service.update(autor.id, id, {
          fecha_nacimiento: '1990-04-12',
          fotografia_base64: UNA_IMAGEN,
        });

        const fotos = await service.fotografiasDe(id);
        expect(fotos).toHaveLength(1);
        expect(fotos[0].contenido).toBe(UNA_IMAGEN);
      });
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
