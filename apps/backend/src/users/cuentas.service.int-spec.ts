import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import * as bcryptjs from 'bcryptjs';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { CuentasService } from './cuentas.service';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { NOMBRE_DE_CUENTA_ELIMINADA, correoDeCuentaEliminada } from './domain/cuenta-eliminada';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { Dispositivo } from '../alertas/entities/dispositivo.entity';
import { Falta } from '../sanciones/entities/falta.entity';

const hashDe = (ci: string) => createHash('sha256').update(ci).digest('hex');
const CONTRASENA = 'contrasena-de-prueba';

describe('Eliminar y recuperar una cuenta (integración)', () => {
  let ctx: ContextoDePruebas;
  let cuentas: CuentasService;
  let usersService: UsersService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let emisiones: Repository<EmisionAlerta>;
  let dispositivos: Repository<Dispositivo>;
  let faltas: Repository<Falta>;
  let hashContrasena: string;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([User, RefreshToken, Denuncia, EmisionAlerta, Dispositivo, Falta]),
      ],
      providers: [CuentasService, UsersService],
    });
    cuentas = ctx.module.get(CuentasService);
    usersService = ctx.module.get(UsersService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    emisiones = ctx.module.get(getRepositoryToken(EmisionAlerta));
    dispositivos = ctx.module.get(getRepositoryToken(Dispositivo));
    faltas = ctx.module.get(getRepositoryToken(Falta));
    // Una vez: bcrypt tarda, y todas las cuentas de prueba usan la misma.
    hashContrasena = await bcryptjs.hash(CONTRASENA, 4);
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => ctx.limpiar());

  const crearCuenta = async (email: string, ci?: string) => {
    const cuenta = await usuarios.save(
      usuarios.create({
        full_name: 'Ana Rocío Quispe Mamani',
        primer_nombre: 'Ana',
        segundo_nombre: 'Rocío',
        primer_apellido: 'Quispe',
        segundo_apellido: 'Mamani',
        email,
        phone: '70000000',
        password_hash: hashContrasena,
        documento_registrado: Boolean(ci),
        ci_hash: ci ? hashDe(ci) : null,
        nombre_documento: ci ? 'Ana Rocío Quispe Mamani' : null,
      })
    );
    await usuarios.query(
      `UPDATE users SET last_location = ST_SetSRID(ST_MakePoint(-68.15, -16.5), 4326)::geography,
              last_location_at = now() WHERE id = $1`,
      [cuenta.id]
    );
    await dispositivos.save(
      dispositivos.create({
        usuario_id: cuenta.id,
        push_token: `ExponentPushToken[${email}]`,
        plataforma: 'android',
        ultima_actividad: new Date(),
      })
    );
    return cuenta;
  };

  const crearDenunciaActiva = async (autorId: string, ciBuscada = '9999') =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: hashDe(ciBuscada),
        latitude: -16.5,
        longitude: -68.15,
        nivel_confianza: NivelConfianza.PROVISIONAL,
        estado: EstadoDenuncia.ACTIVA,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 24 * 3600 * 1000),
      })
    );

  /** Una declaración jurada mínima, escrita directo: aquí importa que exista, no cómo se firmó. */
  const firmarDeclaracion = async (usuarioId: string, ci: string, denunciaId: string) => {
    const [version] = await usuarios.query(
      `SELECT id, hash_texto FROM versiones_texto_legal LIMIT 1`
    );
    await usuarios.query(
      `INSERT INTO declaraciones_juradas
         (denuncia_id, usuario_id, ci_hash_declarante, vinculo_declarado, version_texto_legal_id,
          hash_texto_legal, texto_firmado, hash_contenido_denuncia, hash_registro)
       VALUES ($1, $2, $3, 'HIJO_A', $4, $5, 'Ana Rocío Quispe Mamani', $6, $7)`,
      [
        denunciaId,
        usuarioId,
        hashDe(ci),
        version.id,
        version.hash_texto,
        'c'.repeat(64),
        hashDe(denunciaId),
      ]
    );
  };

  const releer = (id: string) => usuarios.findOneByOrFail({ id });

  describe('eliminar', () => {
    it('borra los datos personales y conserva el hash del documento', async () => {
      const cuenta = await crearCuenta('ana@test.bo', '1234567');

      const resultado = await cuentas.eliminar(cuenta.id, CONTRASENA);

      expect(resultado.mensaje).toBe('Tu cuenta se eliminó.');
      const eliminada = await releer(cuenta.id);
      expect(eliminada).toMatchObject({
        full_name: NOMBRE_DE_CUENTA_ELIMINADA,
        primer_nombre: null,
        segundo_nombre: null,
        primer_apellido: null,
        segundo_apellido: null,
        email: correoDeCuentaEliminada(cuenta.id),
        phone: null,
        push_token: null,
        last_location: null,
        last_location_at: null,
        // Sin declaraciones firmadas, el nombre del documento tampoco queda.
        nombre_documento: null,
        ci_hash: hashDe('1234567'),
        documento_registrado: true,
      });
      expect(eliminada.deleted_at).toBeInstanceOf(Date);
      expect(await dispositivos.countBy({ usuario_id: cuenta.id })).toBe(0);
    });

    it('después no se puede entrar ni seguir usando la sesión', async () => {
      const cuenta = await crearCuenta('ana@test.bo', '1234567');

      await cuentas.eliminar(cuenta.id, CONTRASENA);

      expect(await usersService.findByEmail('ana@test.bo')).toBeNull();
      expect(await usersService.estaActiva(cuenta.id)).toBe(false);
      // La contraseña vieja ya no corresponde a ningún hash guardado.
      expect(await bcryptjs.compare(CONTRASENA, (await releer(cuenta.id)).password_hash)).toBe(
        false
      );
      await expect(cuentas.eliminar(cuenta.id, CONTRASENA)).rejects.toThrow(UnauthorizedException);
    });

    it('con la contraseña equivocada no toca nada', async () => {
      const cuenta = await crearCuenta('ana@test.bo', '1234567');

      await expect(cuentas.eliminar(cuenta.id, 'otra-contrasena')).rejects.toThrow(
        ForbiddenException
      );
      const intacta = await releer(cuenta.id);
      expect(intacta.email).toBe('ana@test.bo');
      expect(intacta.deleted_at).toBeNull();
    });

    it('sus alertas activas dejan de difundirse, pero el aviso a la persona reportada sale', async () => {
      const cuenta = await crearCuenta('ana@test.bo', '1234567');
      const denuncia = await crearDenunciaActiva(cuenta.id);
      const difusion = await emisiones.save(
        emisiones.create({ denuncia_id: denuncia.id, motivo: 'firma', radio_m: 2000 })
      );
      const aviso = await emisiones.save(
        emisiones.create({ denuncia_id: denuncia.id, motivo: 'coincidencia_documento', radio_m: 0 })
      );

      await cuentas.eliminar(cuenta.id, CONTRASENA);

      expect((await denuncias.findOneByOrFail({ id: denuncia.id })).estado).toBe(
        EstadoDenuncia.CADUCADA
      );
      expect((await emisiones.findOneByOrFail({ id: difusion.id })).estado).toBe('completada');
      // La denuncia sigue existiendo: a la persona reportada le sirve saberlo para retirarla.
      expect((await emisiones.findOneByOrFail({ id: aviso.id })).estado).toBe('pendiente');
    });

    it('si firmó declaraciones, conserva el nombre del documento: sin él la constancia no diría quién firmó', async () => {
      const cuenta = await crearCuenta('ana@test.bo', '1234567');
      const denuncia = await crearDenunciaActiva(cuenta.id);
      await firmarDeclaracion(cuenta.id, '1234567', denuncia.id);

      await cuentas.eliminar(cuenta.id, CONTRASENA);

      const eliminada = await releer(cuenta.id);
      expect(eliminada.nombre_documento).toBe('Ana Rocío Quispe Mamani');
      expect(eliminada.full_name).toBe(NOMBRE_DE_CUENTA_ELIMINADA);
      const [{ total }] = await usuarios.query(
        `SELECT count(*)::int AS total FROM declaraciones_juradas WHERE usuario_id = $1`,
        [cuenta.id]
      );
      expect(total).toBe(1);
    });

    it('una cuenta sin documento también se puede eliminar', async () => {
      const cuenta = await crearCuenta('visitante@test.bo');

      await cuentas.eliminar(cuenta.id, CONTRASENA);

      expect((await releer(cuenta.id)).deleted_at).toBeInstanceOf(Date);
    });
  });

  describe('recuperar con el mismo carnet', () => {
    it('vuelve la cuenta eliminada, con los datos de la nueva y sus faltas de antes', async () => {
      const vieja = await crearCuenta('ana@test.bo', '1234567');
      const denuncia = await crearDenunciaActiva(vieja.id);
      await faltas.save(
        faltas.create({
          usuario_id: vieja.id,
          tipo: 'CIERRE_CON_SANCION',
          denuncia_id: denuncia.id,
        })
      );
      await cuentas.eliminar(vieja.id, CONTRASENA);
      const nueva = await crearCuenta('ana.nueva@test.bo');

      const recuperada = await cuentas.recuperar(vieja.id, nueva.id);

      expect(recuperada.id).toBe(vieja.id);
      expect(recuperada).toMatchObject({
        email: 'ana.nueva@test.bo',
        full_name: 'Ana Rocío Quispe Mamani',
        nombre_documento: 'Ana Rocío Quispe Mamani',
        ci_hash: hashDe('1234567'),
        deleted_at: null,
      });
      expect(await faltas.countBy({ usuario_id: vieja.id })).toBe(1);
      expect(await usersService.estaActiva(vieja.id)).toBe(true);
      // La nueva queda eliminada: su sesión ya no vale.
      expect(await usersService.estaActiva(nueva.id)).toBe(false);
      expect((await usersService.findByEmail('ana.nueva@test.bo'))?.id).toBe(vieja.id);
      expect(await bcryptjs.compare(CONTRASENA, recuperada.password_hash)).toBe(true);
    });

    it('no junta dos identidades: una cuenta con su propio documento no recupera otra', async () => {
      const vieja = await crearCuenta('ana@test.bo', '1234567');
      await cuentas.eliminar(vieja.id, CONTRASENA);
      const otra = await crearCuenta('otra@test.bo', '7654321');

      await expect(cuentas.recuperar(vieja.id, otra.id)).rejects.toThrow(BadRequestException);
      expect(await usersService.estaActiva(vieja.id)).toBe(false);
    });

    it('una cuenta viva no se puede «recuperar»', async () => {
      const viva = await crearCuenta('ana@test.bo', '1234567');
      const nueva = await crearCuenta('nueva@test.bo');

      await expect(cuentas.recuperar(viva.id, nueva.id)).rejects.toThrow(BadRequestException);
    });
  });
});
