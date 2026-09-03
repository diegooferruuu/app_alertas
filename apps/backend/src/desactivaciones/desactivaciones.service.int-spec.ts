import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { DesactivacionesService } from './desactivaciones.service';
import { Desactivacion } from './entities/desactivacion.entity';
import { DocumentoBloqueado } from './entities/documento-bloqueado.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { User } from '../users/entities/user.entity';
import { ReputationEvent } from '../users/entities/reputation-event.entity';
import { EstadoCuenta } from '../users/domain/estado-cuenta';
import { UsersService } from '../users/users.service';

const LA_PAZ = { lat: -16.5, lng: -68.15 };

const hashDe = (ci: string) => createHash('sha256').update(ci).digest('hex');

describe('Interruptor de desactivación (integración)', () => {
  let ctx: ContextoDePruebas;
  let servicio: DesactivacionesService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let emisiones: Repository<EmisionAlerta>;
  let desactivaciones: Repository<Desactivacion>;
  let bloqueados: Repository<DocumentoBloqueado>;
  let reputacion: Repository<ReputationEvent>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          Desactivacion,
          DocumentoBloqueado,
          Denuncia,
          EmisionAlerta,
          User,
          ReputationEvent,
        ]),
      ],
      providers: [DesactivacionesService, UsersService],
    });
    servicio = ctx.module.get(DesactivacionesService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    emisiones = ctx.module.get(getRepositoryToken(EmisionAlerta));
    desactivaciones = ctx.module.get(getRepositoryToken(Desactivacion));
    bloqueados = ctx.module.get(getRepositoryToken(DocumentoBloqueado));
    reputacion = ctx.module.get(getRepositoryToken(ReputationEvent));
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

  describe('autorización', () => {
    it('permite retirarla a quien el documento de la denuncia identifica', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const resultado = await servicio.desactivar(reportada.id, denuncia.id);

      expect(resultado.desactivada).toBe(true);
      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.INVALIDADA);
    });

    it('no deja retirar una denuncia que identifica a otra persona', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const ajeno = await crearUsuario('ajeno@t.bo', '333');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await expect(servicio.desactivar(ajeno.id, denuncia.id)).rejects.toThrow(
        NotFoundException,
      );
      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.ACTIVA);
    });

    it('tampoco al propio denunciante: no es una vía para borrar lo que uno firmó', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await expect(servicio.desactivar(autor.id, denuncia.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('devuelve el mismo error para una denuncia ajena que para una inexistente', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const ajeno = await crearUsuario('ajeno@t.bo', '333');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const error = async (id: string): Promise<Error> => {
        try {
          await servicio.desactivar(ajeno.id, id);
          throw new Error('se esperaba un rechazo');
        } catch (e) {
          return e as Error;
        }
      };

      const ajena = await error(denuncia.id);
      const inexistente = await error('00000000-0000-4000-8000-000000000000');

      // Distinguirlos convertiría el endpoint en una forma de comprobar si un
      // documento cualquiera está denunciado.
      expect(ajena.message).toBe(inexistente.message);
      expect(ajena.constructor).toBe(inexistente.constructor);
    });

    it('exige documento registrado para poder accionar el interruptor', async () => {
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

      await expect(
        servicio.desactivar(sinDocumento.id, denuncia.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('atomicidad', () => {
    it('revoca las emisiones pendientes en la misma operación', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await emisiones.insert({
        denuncia_id: denuncia.id,
        radio_m: 2000,
        motivo: 'firma',
        estado: 'pendiente',
      });
      await emisiones.insert({
        denuncia_id: denuncia.id,
        usuario_objetivo_id: reportada.id,
        radio_m: null,
        motivo: 'coincidencia_documento',
        estado: 'procesando',
      });

      await servicio.desactivar(reportada.id, denuncia.id);

      const vivas = await emisiones.count({
        where: [
          { denuncia_id: denuncia.id, estado: 'pendiente' },
          { denuncia_id: denuncia.id, estado: 'procesando' },
        ],
      });
      expect(vivas).toBe(0);

      const revocadas = await emisiones.find({
        where: { denuncia_id: denuncia.id },
      });
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

      await servicio.desactivar(reportada.id, denuncia.id);

      const despues = await emisiones.findOneOrFail({ where: { id: ya.id } });
      expect(despues.destinatarios).toBe(47);
      expect(despues.ultimo_error).toBeNull();
    });

    it('deja el registro de la desactivación con ambos hashes', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.desactivar(reportada.id, denuncia.id);

      const registro = await desactivaciones.findOneOrFail({
        where: { denuncia_id: denuncia.id },
      });
      expect(registro.ci_hash_denunciante).toBe(hashDe('111'));
      expect(registro.ci_hash_persona_buscada).toBe(hashDe('222'));
    });

    it('no borra la denuncia: queda invalidada y sigue siendo consultable (I7)', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.desactivar(reportada.id, denuncia.id);

      const despues = await denuncias.findOneOrFail({
        where: { id: denuncia.id },
      });
      expect(despues.estado).toBe(EstadoDenuncia.INVALIDADA);
      // Se conserva el alcance que llegó a tener: es parte del registro.
      expect(despues.radio_actual_m).toBe(2000);
      expect(despues.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
    });

    it('si el registro falla, nada queda a medias', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      // Ocupa la fila única de antemano: el INSERT del paso 4 chocará y debe
      // arrastrar consigo la invalidación del paso 1.
      await desactivaciones.insert({
        denuncia_id: denuncia.id,
        ci_hash_denunciante: hashDe('111'),
        ci_hash_persona_buscada: hashDe('222'),
      });

      await expect(
        servicio.desactivar(reportada.id, denuncia.id),
      ).rejects.toThrow();

      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.ACTIVA);
    });
  });

  describe('estados', () => {
    it('permite retirar una denuncia CADUCADA: puede revivir por corroboración', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await denuncias.update(denuncia.id, {
        estado: EstadoDenuncia.CADUCADA,
      });

      await servicio.desactivar(reportada.id, denuncia.id);

      expect(await estadoDe(denuncia.id)).toBe(EstadoDenuncia.INVALIDADA);
    });

    it('rechaza retirar dos veces la misma denuncia', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.desactivar(reportada.id, denuncia.id);
      await expect(
        servicio.desactivar(reportada.id, denuncia.id),
      ).rejects.toThrow(ConflictException);

      expect(await desactivaciones.count()).toBe(1);
    });

    it('rechaza retirar una denuncia CERRADA', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await denuncias.update(denuncia.id, { estado: EstadoDenuncia.CERRADA });

      await expect(
        servicio.desactivar(reportada.id, denuncia.id),
      ).rejects.toThrow(ConflictException);
    });

    it('INVALIDADA es terminal: la caducidad ya no la alcanza', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await servicio.desactivar(reportada.id, denuncia.id);

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

    it('deja de listarla una vez retirada', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.desactivar(reportada.id, denuncia.id);

      expect(await servicio.denunciasQueMeIdentifican(reportada.id)).toEqual([]);
    });

    it('el resultado no nombra al denunciante pero sí anuncia la constancia', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const resultado = await servicio.desactivar(reportada.id, denuncia.id);

      const serializado = JSON.stringify(resultado);
      expect(serializado).not.toContain(autor.id);
      expect(serializado).not.toContain(autor.email);
      expect(serializado).not.toContain(autor.full_name);
      expect(resultado.constancia_disponible).toBe(true);
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

      expect(
        await servicio.denunciasQueMeIdentifican(sinDocumento.id),
      ).toEqual([]);
    });
  });

  describe('recuento para la sanción graduada', () => {
    it('cuenta las desactivaciones por denunciante y las dirigidas a una persona', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');

      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '222');
      const d3 = await crearDenunciaDifundida(autor.id, '333');

      await servicio.desactivar(a.id, d1.id);
      await servicio.desactivar(a.id, d2.id);
      await servicio.desactivar(b.id, d3.id);

      expect(await servicio.recibidasPor(hashDe('111'))).toBe(3);
      // Dos contra el mismo documento: es la reincidencia dirigida.
      expect(
        await servicio.reincidenciaDirigida(hashDe('111'), hashDe('222')),
      ).toBe(2);
      expect(
        await servicio.reincidenciaDirigida(hashDe('111'), hashDe('333')),
      ).toBe(1);
    });
  });

  describe('restricciones de la base', () => {
    it('una denuncia no admite dos registros de desactivación', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      await servicio.desactivar(reportada.id, denuncia.id);

      await expect(
        desactivaciones.insert({
          denuncia_id: denuncia.id,
          ci_hash_denunciante: hashDe('111'),
          ci_hash_persona_buscada: hashDe('222'),
        }),
      ).rejects.toThrow();
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

  /**
   * H4.5 — Sanción graduada (§5.4, invariante I9).
   *
   * Un evento único no puede acarrear sanción permanente —la desactivación no es
   * verificable—, así que la primera restringe temporalmente y solo el patrón
   * suspende. El sistema lo detecta por sí mismo, dentro de la misma transacción.
   */
  describe('sanción graduada al denunciante (H4.5)', () => {
    const estadoCuentaDe = async (id: string) =>
      (await usuarios.findOneOrFail({ where: { id } })).estado_cuenta;

    it('la primera desactivación restringe temporalmente, no suspende', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      await servicio.desactivar(reportada.id, denuncia.id);

      const denunciante = await usuarios.findOneOrFail({ where: { id: autor.id } });
      expect(denunciante.estado_cuenta).toBe(EstadoCuenta.RESTRINGIDA);
      expect(denunciante.restringida_hasta).toBeInstanceOf(Date);
      expect(denunciante.restringida_hasta!.getTime()).toBeGreaterThan(Date.now());
      // Restringida no es bloqueada: el documento sigue libre.
      expect(await bloqueados.count()).toBe(0);
    });

    it('descuenta reputación en la desactivación, con suelo en cero', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');

      const antes = (await usuarios.findOneOrFail({ where: { id: autor.id } }))
        .reputation_score;
      await servicio.desactivar(reportada.id, denuncia.id);
      const despues = (await usuarios.findOneOrFail({ where: { id: autor.id } }))
        .reputation_score;

      expect(despues).toBeLessThan(antes);
      expect(despues).toBeGreaterThanOrEqual(0);
      const eventos = await reputacion.find({ where: { user_id: autor.id } });
      expect(eventos).toHaveLength(1);
      expect(eventos[0].delta).toBeLessThan(0);
      expect(eventos[0].reference_id).toBe(denuncia.id);
    });

    it('la segunda desactivación, de otro caso, suspende y bloquea el documento', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '333');

      await servicio.desactivar(a.id, d1.id);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.RESTRINGIDA);

      await servicio.desactivar(b.id, d2.id);
      const denunciante = await usuarios.findOneOrFail({ where: { id: autor.id } });
      expect(denunciante.estado_cuenta).toBe(EstadoCuenta.SUSPENDIDA);
      // La suspensión no lleva plazo.
      expect(denunciante.restringida_hasta).toBeNull();

      const bloqueo = await bloqueados.findOneOrFail({
        where: { ci_hash: hashDe('111') },
      });
      expect(bloqueo.usuario_id).toBe(autor.id);
      expect(bloqueo.motivo).toBe('segunda_desactivacion');
    });

    it('denunciar dos veces a la misma persona y que la retire suspende de inmediato', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '222');

      await servicio.desactivar(reportada.id, d1.id);
      await servicio.desactivar(reportada.id, d2.id);

      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.SUSPENDIDA);
      const bloqueo = await bloqueados.findOneOrFail({
        where: { ci_hash: hashDe('111') },
      });
      expect(bloqueo.motivo).toBe('reincidencia_dirigida');
    });

    it('bloquear el documento es idempotente: una tercera desactivación no falla', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const a = await crearUsuario('a@t.bo', '222');
      const b = await crearUsuario('b@t.bo', '333');
      const c = await crearUsuario('c@t.bo', '444');
      const d1 = await crearDenunciaDifundida(autor.id, '222');
      const d2 = await crearDenunciaDifundida(autor.id, '333');
      const d3 = await crearDenunciaDifundida(autor.id, '444');

      await servicio.desactivar(a.id, d1.id);
      await servicio.desactivar(b.id, d2.id);
      // La tercera intentaría bloquear un documento ya bloqueado: no debe fallar.
      await expect(servicio.desactivar(c.id, d3.id)).resolves.toBeDefined();

      expect(await bloqueados.count()).toBe(1);
      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.SUSPENDIDA);
    });

    it('la sanción viaja en la misma transacción: si la desactivación se revierte, no queda sanción', async () => {
      const autor = await crearUsuario('autor@t.bo', '111');
      const reportada = await crearUsuario('reportada@t.bo', '222');
      const denuncia = await crearDenunciaDifundida(autor.id, '222');
      // Ocupa de antemano la fila única de desactivación: el paso 4 chocará y
      // arrastrará consigo la sanción del paso 5.
      await desactivaciones.insert({
        denuncia_id: denuncia.id,
        ci_hash_denunciante: hashDe('111'),
        ci_hash_persona_buscada: hashDe('222'),
      });

      await expect(servicio.desactivar(reportada.id, denuncia.id)).rejects.toThrow();

      expect(await estadoCuentaDe(autor.id)).toBe(EstadoCuenta.ACTIVA);
      expect(await reputacion.count({ where: { user_id: autor.id } })).toBe(0);
      expect(await bloqueados.count()).toBe(0);
    });
  });
});
