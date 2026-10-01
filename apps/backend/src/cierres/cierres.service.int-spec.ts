import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { CierresService } from './cierres.service';
import { Cierre, TipoCierre } from './entities/cierre.entity';
import { Falta } from '../sanciones/entities/falta.entity';
import { DocumentoBloqueado } from '../sanciones/entities/documento-bloqueado.entity';
import { SancionesService } from '../sanciones/sanciones.service';
import { EstadoSancion } from '../sanciones/domain/situacion';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { User } from '../users/entities/user.entity';
import { EstadoCuenta } from '../users/domain/estado-cuenta';
import { UsersService } from '../users/users.service';

const LA_PAZ = { lat: -16.5, lng: -68.15 };

const hashDe = (ci: string) => createHash('sha256').update(ci).digest('hex');

const ES_FALSA = { tipo: TipoCierre.CON_SANCION };
const ESTOY_BIEN_SIN_BLOQUEO = { tipo: TipoCierre.SIN_SANCION, bloquear_nueva_denuncia: false };
const ESTOY_BIEN_CON_BLOQUEO = { tipo: TipoCierre.SIN_SANCION, bloquear_nueva_denuncia: true };

describe('Cierre de una alerta por la persona reportada (integración)', () => {
  let ctx: ContextoDePruebas;
  let servicio: CierresService;
  let sanciones: SancionesService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let emisiones: Repository<EmisionAlerta>;
  let cierres: Repository<Cierre>;
  let faltas: Repository<Falta>;
  let bloqueados: Repository<DocumentoBloqueado>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          Cierre,
          Falta,
          DocumentoBloqueado,
          Denuncia,
          EmisionAlerta,
          User,
        ]),
      ],
      providers: [CierresService, SancionesService, UsersService],
    });
    servicio = ctx.module.get(CierresService);
    sanciones = ctx.module.get(SancionesService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    emisiones = ctx.module.get(getRepositoryToken(EmisionAlerta));
    cierres = ctx.module.get(getRepositoryToken(Cierre));
    faltas = ctx.module.get(getRepositoryToken(Falta));
    bloqueados = ctx.module.get(getRepositoryToken(DocumentoBloqueado));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => ctx.limpiar());

  const crearUsuario = async (email: string, ci: string) =>
    usuarios.save(
      usuarios.create({
        full_name: `Persona ${email}`,
        email,
        password_hash: 'x',
        documento_registrado: true,
        ci_hash: hashDe(ci),
        nombre_documento: `Persona ${email}`,
      }),
    );

  /** Una denuncia ya difundiéndose contra el documento indicado. */
  const crearDenunciaDifundida = async (autorId: string, ciBuscada: string) =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: hashDe(ciBuscada),
        description: 'Visto por última vez el martes',
        latitude: LA_PAZ.lat,
        longitude: LA_PAZ.lng,
        nivel_confianza: NivelConfianza.PROVISIONAL,
        estado: EstadoDenuncia.ACTIVA,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 24 * 3600 * 1000),
      }),
    );

  const estadoDe = async (id: string) =>
    (await denuncias.findOneOrFail({ where: { id } })).estado;

  const estadoCuentaDe = async (id: string) =>
    (await usuarios.findOneOrFail({ where: { id } })).estado_cuenta;

  describe('autorización', () => {
    it('permite cerrarla a quien el documento de la denuncia identifica', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const resultado = await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      expect(resultado.cerrada).toBe(true);
      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.INVALIDADA);
    });

    it('no deja cerrar una denuncia que identifica a otra persona', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const ajeno = await crearUsuario('ajeno@t.bo', '333');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await expect(servicio.cerrar(ajeno.id, denuncia.id, ES_FALSA)).rejects.toThrow(
        NotFoundException,
      );
      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.ACTIVA);
    });

    it('tampoco al propio denunciante: no es una vía para borrar lo que uno firmó', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await expect(servicio.cerrar(autor.id, denuncia.id, ES_FALSA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve el mismo error para una denuncia ajena que para una inexistente', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const ajeno = await crearUsuario('ajeno@t.bo', '333');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const error = async (id: string): Promise<Error> => {
        try {
          await servicio.cerrar(ajeno.id, id, ES_FALSA);
          throw new Error('se esperaba un rechazo');
        } catch (e) {
          return e as Error;
        }
      };

      const ajena = await error(denuncia.id);
      const inexistente = await error('00000000-0000-4000-8000-000000000000');

      // Distinguirlos convertiría la ruta en una forma de comprobar si un
      // documento cualquiera está denunciado.
      expect(ajena.message).toBe(inexistente.message);
      expect(ajena.constructor).toBe(inexistente.constructor);
    });

    it('exige documento registrado para poder cerrar', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      const sinDocumento = await usuarios.save(
        usuarios.create({
          full_name: 'Sin documento',
          email: 'sindoc@t.bo',
          password_hash: 'x',
          documento_registrado: false,
        }),
      );

      await expect(servicio.cerrar(sinDocumento.id, denuncia.id, ES_FALSA)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('los dos tipos de cierre', () => {
    it('«Estoy bien» exige decidir si quien denunció podrá volver a hacerlo', async () => {
      // La app pregunta sin opción marcada: si la respuesta no llega, no se
      // supone ninguna, y no se cierra nada a medias.
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await expect(
        servicio.cerrar(reportada.id, denuncia.id, { tipo: TipoCierre.SIN_SANCION }),
      ).rejects.toThrow(BadRequestException);

      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.ACTIVA);
      expect(await cierres.count()).toBe(0);
    });

    it('«Es falsa» siempre bloquea volver a denunciar, aunque se pida lo contrario', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, denuncia.id, {
        tipo: TipoCierre.CON_SANCION,
        bloquear_nueva_denuncia: false,
      });

      const cierre = await cierres.findOneOrFail({ where: { denuncia_id: denuncia.id } });
      expect(cierre.bloquea_nueva_denuncia).toBe(true);
    });

    it('«Estoy bien» guarda lo que la persona eligió sobre el bloqueo', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '333');

      await servicio.cerrar(a.id, d1.id, ESTOY_BIEN_SIN_BLOQUEO);
      await servicio.cerrar(b.id, d2.id, ESTOY_BIEN_CON_BLOQUEO);

      expect((await cierres.findOneByOrFail({ denuncia_id: d1.id })).bloquea_nueva_denuncia).toBe(false);
      expect((await cierres.findOneByOrFail({ denuncia_id: d2.id })).bloquea_nueva_denuncia).toBe(true);
    });

    it('los dos dejan la denuncia INVALIDADA: el tipo solo queda en el cierre', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '333');

      await servicio.cerrar(a.id, d1.id, ES_FALSA);
      await servicio.cerrar(b.id, d2.id, ESTOY_BIEN_SIN_BLOQUEO);

      expect(await estadoDe(d1.id)).toBe(EstadoDenuncia.INVALIDADA);
      expect(await estadoDe(d2.id)).toBe(EstadoDenuncia.INVALIDADA);
    });
  });

  describe('atomicidad', () => {
    it('revoca las emisiones pendientes en la misma operación', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await emisiones.insert({ denuncia_id: denuncia.id, radio_m: 2000, motivo: 'firma', estado: 'pendiente' });
      await emisiones.insert({
        denuncia_id: denuncia.id,
        usuario_objetivo_id: reportada.id,
        radio_m: null,
        motivo: 'coincidencia_documento',
        estado: 'procesando',
      });

      await servicio.cerrar(reportada.id, denuncia.id, ESTOY_BIEN_SIN_BLOQUEO);

      const revocadas = await emisiones.find({ where: { denuncia_id: denuncia.id } });
      expect(revocadas).toHaveLength(2);
      for (const e of revocadas) {
        expect(e.estado).toBe('completada');
        expect(e.destinatarios).toBe(0);
        expect(e.ultimo_error).toContain('revocada');
      }
    });

    it('no toca las emisiones ya completadas: son el registro de lo que sí salió', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      const ya = await emisiones.save(
        emisiones.create({
          denuncia_id: denuncia.id,
          radio_m: 2000,
          motivo: 'firma',
          estado: 'completada',
          destinatarios: 47,
          emitida_en: new Date(),
        }),
      );

      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      const despues = await emisiones.findOneOrFail({ where: { id: ya.id } });
      expect(despues.destinatarios).toBe(47);
      expect(despues.ultimo_error).toBeNull();
    });

    it('deja el registro del cierre con ambos hashes y su tipo', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      const registro = await cierres.findOneOrFail({ where: { denuncia_id: denuncia.id } });
      expect(registro.ci_hash_denunciante).toBe(hashDe('111'));
      expect(registro.ci_hash_persona_buscada).toBe(hashDe('222'));
      expect(registro.tipo_cierre).toBe(TipoCierre.CON_SANCION);
    });

    it('no borra la denuncia: queda invalidada y sigue siendo consultable (I7)', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      const despues = await denuncias.findOneOrFail({ where: { id: denuncia.id } });
      expect(despues.estado).toBe(EstadoDenuncia.INVALIDADA);
      // Se conserva el alcance que llegó a tener: es parte del registro.
      expect(despues.radio_actual_m).toBe(2000);
      expect(despues.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
    });

    it('si el registro falla, nada queda a medias: ni invalidada, ni falta, ni bloqueo', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      // Ocupa de antemano la fila única del cierre: la inserción chocará y debe
      // arrastrar consigo la invalidación y la sanción.
      await cierres.insert({
        denuncia_id: denuncia.id,
        ci_hash_denunciante: hashDe('111'),
        ci_hash_persona_buscada: hashDe('222'),
        tipo_cierre: TipoCierre.SIN_SANCION,
        bloquea_nueva_denuncia: false,
      });

      await expect(servicio.cerrar(reportada.id, denuncia.id, ES_FALSA)).rejects.toThrow();

      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.ACTIVA);
      expect(await faltas.count()).toBe(0);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.ACTIVA);
    });
  });

  describe('estados', () => {
    it('permite cerrar una denuncia CADUCADA: podría revivir con el caso de la FELCC', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await denuncias.update(denuncia.id, { estado: EstadoDenuncia.CADUCADA });

      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.INVALIDADA);
    });

    it('rechaza cerrar dos veces la misma denuncia', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);
      await expect(servicio.cerrar(reportada.id, denuncia.id, ES_FALSA)).rejects.toThrow(
        ConflictException,
      );

      expect(await cierres.count()).toBe(1);
      expect(await faltas.count()).toBe(1);
    });

    it('rechaza cerrar una denuncia CERRADA', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await denuncias.update(denuncia.id, { estado: EstadoDenuncia.CERRADA });

      await expect(servicio.cerrar(reportada.id, denuncia.id, ES_FALSA)).rejects.toThrow(
        ConflictException,
      );
    });

    it('INVALIDADA es terminal: la caducidad ya no la alcanza', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      // La consulta del planificador de caducidad, tal cual: solo ACTIVAS.
      const alcanzadas = await denuncias.count({
        where: { id: denuncia.id, estado: EstadoDenuncia.ACTIVA },
      });
      expect(alcanzadas).toBe(0);
    });
  });

  describe('lo que ve la persona reportada', () => {
    it('lista las denuncias que la identifican sin revelar quién denunció (I8)', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const lista = await servicio.denunciasQueMeIdentifican(reportada.id);

      expect(lista).toHaveLength(1);
      expect(lista[0].id).toBe(denuncia.id);
      expect(lista[0].se_esta_difundiendo).toBe(true);

      const serializado = JSON.stringify(lista);
      expect(serializado).not.toContain(autor.id);
      expect(serializado).not.toContain(autor.email);
      expect(serializado).not.toContain(autor.full_name);
      expect(serializado).not.toContain(hashDe('111'));
      // Tampoco el hash de la propia persona: no hace falta y es un dato menos.
      expect(serializado).not.toContain(hashDe('222'));
    });

    it('no muestra las denuncias que identifican a otras personas', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      await crearDenunciaDifundida(autor.id, '999');

      expect(await servicio.denunciasQueMeIdentifican(reportada.id)).toEqual([]);
    });

    it('incluye las caducadas, que pueden volver a difundirse', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await denuncias.update(denuncia.id, { estado: EstadoDenuncia.CADUCADA });

      const lista = await servicio.denunciasQueMeIdentifican(reportada.id);

      expect(lista).toHaveLength(1);
      expect(lista[0].estado).toBe(EstadoDenuncia.CADUCADA);
      // Aparece, pero sin dar a entender que hay una alerta circulando.
      expect(lista[0].se_esta_difundiendo).toBe(false);
    });

    it('sigue listándola tras cerrarla, pero ya no como cerrable', async () => {
      // No desaparece a propósito: la constancia está disponible de forma
      // indefinida (§6.1) y esta lista es el único camino hacia ella.
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      const lista = await servicio.denunciasQueMeIdentifican(reportada.id);
      expect(lista).toHaveLength(1);
      expect(lista[0].estado).toBe(EstadoDenuncia.INVALIDADA);
      expect(lista[0].se_esta_difundiendo).toBe(false);
      expect(lista[0].puede_cerrarse).toBe(false);
    });

    it('marca como cerrables las activas y las caducadas', async () => {
      // Dos autores distintos: uno solo no puede tener dos denuncias abiertas
      // sobre la misma persona.
      const autorA = await crearUsuario('autor-a@t.bo', '111');
      const autorB = await crearUsuario('autor-b@t.bo', '112');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const activa = await crearDenunciaDifundida(autorA.id, '222');
      const caducada = await crearDenunciaDifundida(autorB.id, '222');
      await denuncias.update(caducada.id, { estado: EstadoDenuncia.CADUCADA });

      const lista = await servicio.denunciasQueMeIdentifican(reportada.id);
      const por = (id: string) => lista.find((d) => d.id === id)!;

      expect(por(activa.id).puede_cerrarse).toBe(true);
      expect(por(caducada.id).puede_cerrarse).toBe(true);
    });

    it('el resultado no nombra al denunciante pero sí anuncia la constancia', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const resultado = await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      const serializado = JSON.stringify(resultado);
      expect(serializado).not.toContain(autor.id);
      expect(serializado).not.toContain(autor.email);
      expect(serializado).not.toContain(autor.full_name);
      expect(resultado.constancia_disponible).toBe(true);
    });

    it('no promete una constancia si nadie llegó a firmar la denuncia', async () => {
      // La constancia se arma con la declaración jurada: sin firma, pedirla
      // daría un error después de que el cierre la anunciara.
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await denuncias.update(denuncia.id, {
        nivel_confianza: NivelConfianza.REGISTRADA,
        radio_actual_m: null,
        expira_en: null,
      });

      const resultado = await servicio.cerrar(reportada.id, denuncia.id, ESTOY_BIEN_SIN_BLOQUEO);

      expect(resultado.constancia_disponible).toBe(false);
      expect(resultado.mensaje).not.toContain('constancia de esta denuncia');
      expect(resultado.mensaje).toContain('no hay constancia que pedir');
      // Tampoco puede decir que «dejó de difundirse»: nunca se difundió.
      expect(resultado.mensaje).toContain('antes de difundirse');
    });

    it('le dice a la persona qué consecuencia tuvo lo que eligió', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '333');

      const falsa = await servicio.cerrar(a.id, d1.id, ES_FALSA);
      const bien = await servicio.cerrar(b.id, d2.id, ESTOY_BIEN_SIN_BLOQUEO);

      expect(falsa.mensaje).toContain('recibió una falta');
      expect(bien.mensaje).toContain('no recibe ninguna sanción');
    });

    it('sin documento registrado la lista está vacía, no falla', async () => {
      const sinDocumento = await usuarios.save(
        usuarios.create({
          full_name: 'Sin documento',
          email: 'sindoc@t.bo',
          password_hash: 'x',
          documento_registrado: false,
        }),
      );

      expect(await servicio.denunciasQueMeIdentifican(sinDocumento.id)).toEqual([]);
    });
  });

  /**
   * El régimen de faltas: tres estados, y la única fuente de faltas es que la
   * persona reportada declare falsa una denuncia.
   */
  describe('faltas y suspensión', () => {
    it('un «Es falsa» da una falta a quien denunció y no lo suspende (I9)', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      const registradas = await faltas.find({ where: { usuario_id: autor.id } });
      expect(registradas).toHaveLength(1);
      expect(registradas[0].tipo).toBe('CIERRE_CON_SANCION');
      expect(registradas[0].denuncia_id).toBe(denuncia.id);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.ACTIVA);
      expect(await bloqueados.count()).toBe(0);

      const situacion = await sanciones.situacionDe(autor.id);
      expect(situacion.estado).toBe(EstadoSancion.CON_FALTA);
      expect(situacion.funciones_restringidas).toEqual(['DIFUNDIR_SIN_CASO_FELCC']);
    });

    it('«Estoy bien» no da ninguna falta', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, denuncia.id, ESTOY_BIEN_CON_BLOQUEO);

      expect(await faltas.count()).toBe(0);
      expect((await sanciones.situacionDe(autor.id)).estado).toBe(EstadoSancion.NORMAL);
    });

    it('dos personas distintas que la declaran falsa suspenden y bloquean el documento', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '333');

      await servicio.cerrar(a.id, d1.id, ES_FALSA);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.ACTIVA);

      await servicio.cerrar(b.id, d2.id, ES_FALSA);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.SUSPENDIDA);

      const bloqueo = await bloqueados.findOneOrFail({ where: { ci_hash: hashDe('111') } });
      expect(bloqueo.usuario_id).toBe(autor.id);
      expect((await sanciones.situacionDe(autor.id)).funciones_restringidas).toEqual(
        expect.arrayContaining(['DENUNCIAR', 'FIRMAR', 'RECIBIR_ALERTAS']),
      );
    });

    it('la suspensión cuenta personas, no cierres: dos de la misma persona no bastan', async () => {
      // Las reglas de denuncia ya impiden llegar aquí por la vía normal. Se arma
      // a mano para fijar que, si ocurriera, la palabra de una sola persona no
      // suspende una cuenta.
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      await servicio.cerrar(reportada.id, d1.id, ES_FALSA);
      const d2 = await crearDenunciaDifundida(autor.id, '222');

      await servicio.cerrar(reportada.id, d2.id, ES_FALSA);

      expect(await faltas.count({ where: { usuario_id: autor.id } })).toBe(2);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.ACTIVA);
    });

    it('bloquear el documento es idempotente: una tercera persona no hace fallar el cierre', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const c = await crearUsuario('c@t.bo', '444');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '333');
      const d3 = await crearDenunciaDifundida(autor.id, '444');

      await servicio.cerrar(a.id, d1.id, ES_FALSA);
      await servicio.cerrar(b.id, d2.id, ES_FALSA);
      await expect(servicio.cerrar(c.id, d3.id, ES_FALSA)).resolves.toBeDefined();

      expect(await bloqueados.count()).toBe(1);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.SUSPENDIDA);
    });

    it('el mismo hecho no produce dos faltas', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      await ctx.dataSource.transaction((manager) =>
        sanciones.aplicarCierreConSancion(manager, {
          denuncianteId: autor.id,
          ciHashDenunciante: hashDe('111'),
          denunciaId: denuncia.id,
        }),
      );

      expect(await faltas.count()).toBe(1);
    });

    it('el estado guardado coincide con el que se deriva de los cierres (I12)', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const otro = await crearUsuario('otro@t.bo', '112');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const c = await crearUsuario('c@t.bo', '444');
      await servicio.cerrar(a.id, (await crearDenunciaDifundida(autor.id, '222')).id, ES_FALSA);
      await servicio.cerrar(b.id, (await crearDenunciaDifundida(autor.id, '333')).id, ES_FALSA);
      await servicio.cerrar(c.id, (await crearDenunciaDifundida(otro.id, '444')).id, ESTOY_BIEN_SIN_BLOQUEO);

      for (const usuario of [autor, otro]) {
        const [{ personas, sancionados }] = await ctx.dataSource.query(
          `SELECT count(DISTINCT ci_hash_persona_buscada)::int AS personas,
                  count(*)::int AS sancionados
             FROM cierres WHERE ci_hash_denunciante = $1 AND tipo_cierre = 'CON_SANCION'`,
          [usuario.ci_hash],
        );
        const derivado = personas >= 2 ? EstadoCuenta.SUSPENDIDA : EstadoCuenta.ACTIVA;
        expect(await estadoCuentaDe(usuario.id)).toBe(derivado);
        expect(await faltas.count({ where: { usuario_id: usuario.id } })).toBe(sancionados);
      }
    });

    it('la situación propia no revela la denuncia ni a la persona que la cerró', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      const serializado = JSON.stringify(await sanciones.situacionDe(autor.id));

      expect(serializado).not.toContain(denuncia.id);
      expect(serializado).not.toContain(reportada.id);
      expect(serializado).not.toContain(hashDe('222'));
    });
  });

  describe('solo inserción (I11)', () => {
    const prepararCierre = async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);
    };

    it('un cierre no se puede modificar ni borrar', async () => {
      await prepararCierre();

      await expect(
        ctx.dataSource.query(`UPDATE cierres SET tipo_cierre = 'SIN_SANCION'`),
      ).rejects.toThrow(/solo inserción/);
      await expect(ctx.dataSource.query(`DELETE FROM cierres`)).rejects.toThrow(/solo inserción/);
    });

    it('una falta no se puede modificar ni borrar', async () => {
      await prepararCierre();

      await expect(
        ctx.dataSource.query(`UPDATE faltas SET creada_en = now() - interval '10 years'`),
      ).rejects.toThrow(/solo inserción/);
      await expect(ctx.dataSource.query(`DELETE FROM faltas`)).rejects.toThrow(/solo inserción/);
    });
  });

  describe('restricciones de la base', () => {
    it('una denuncia no admite dos cierres', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await servicio.cerrar(reportada.id, denuncia.id, ES_FALSA);

      await expect(
        cierres.insert({
          denuncia_id: denuncia.id,
          ci_hash_denunciante: hashDe('111'),
          ci_hash_persona_buscada: hashDe('222'),
          tipo_cierre: TipoCierre.SIN_SANCION,
          bloquea_nueva_denuncia: false,
        }),
      ).rejects.toThrow();
    });

    it('rechaza un «Es falsa» que no bloquee volver a denunciar', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await expect(
        cierres.insert({
          denuncia_id: denuncia.id,
          ci_hash_denunciante: hashDe('111'),
          ci_hash_persona_buscada: hashDe('222'),
          tipo_cierre: TipoCierre.CON_SANCION,
          bloquea_nueva_denuncia: false,
        }),
      ).rejects.toThrow(/chk_cierres_falsa_bloquea/);
    });

    it('rechaza dos denuncias abiertas del mismo denunciante sobre la misma persona', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      await crearDenunciaDifundida(autor.id, '222');

      await expect(crearDenunciaDifundida(autor.id, '222')).rejects.toThrow(
        /uq_denuncias_abierta_por_persona/,
      );
    });

    it('impide marcar un documento como registrado sin su hash', async () => {
      await expect(
        ctx.dataSource.query(
          `INSERT INTO users (full_name, email, password_hash, documento_registrado, ci_hash)
           VALUES ('Fantasma', 'fantasma@t.bo', 'x', true, NULL)`,
        ),
      ).rejects.toThrow(/chk_users_documento_con_hash/);
    });
  });
});
