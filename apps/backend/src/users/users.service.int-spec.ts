import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ReputationEvent } from './entities/reputation-event.entity';

describe('UsersService · nombre y registro de documento (integración)', () => {
  let ctx: ContextoDePruebas;
  let service: UsersService;
  let usuarios: Repository<User>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [TypeOrmModule.forFeature([User, RefreshToken, ReputationEvent])],
      providers: [UsersService],
    });
    service = ctx.module.get(UsersService);
    usuarios = ctx.module.get(getRepositoryToken(User));
  });

  afterAll(async () => {
    await ctx.cerrar();
  });

  beforeEach(async () => {
    await ctx.limpiar();
  });

  const crearCuenta = (email = 'maria@test.com') =>
    service.create({
      email,
      password_hash: 'x',
      phone: '70000000',
      primer_nombre: 'María',
      segundo_nombre: 'Fernanda',
      primer_apellido: 'Villarroel',
      segundo_apellido: 'Quispe',
    });

  describe('composición del nombre', () => {
    it('compone el nombre completo a partir de las cuatro partes', async () => {
      const cuenta = await crearCuenta();

      expect(cuenta.full_name).toBe('María Fernanda Villarroel Quispe');
    });

    it('sin segundo nombre no deja un espacio de más en el nombre completo', async () => {
      // El nombre compuesto se compara carácter a carácter con la firma escrita
      // a mano; un espacio doble lo convertiría en un nombre distinto.
      const cuenta = await service.create({
        email: 'luis@test.com',
        password_hash: 'x',
        phone: '70000000',
        primer_nombre: 'Luis',
        primer_apellido: 'Mamani',
        segundo_apellido: 'Choque',
      });

      expect(cuenta.full_name).toBe('Luis Mamani Choque');
      expect(cuenta.segundo_nombre).toBeNull();
    });

    it('guarda las partes además del nombre compuesto', async () => {
      const cuenta = await crearCuenta();

      expect(cuenta.primer_nombre).toBe('María');
      expect(cuenta.segundo_nombre).toBe('Fernanda');
      expect(cuenta.primer_apellido).toBe('Villarroel');
      expect(cuenta.segundo_apellido).toBe('Quispe');
    });

    it('la base rechaza una cuenta con el nombre a medias', async () => {
      // La restricción existe porque `full_name` se compone de las partes: una
      // parte obligatoria ausente produciría un nombre distinto del declarado.
      await expect(
        usuarios.query(
          `INSERT INTO users (full_name, email, password_hash, primer_nombre, primer_apellido)
           VALUES ('Ana Quispe', 'amedias@test.com', 'x', 'Ana', 'Quispe')`,
        ),
      ).rejects.toThrow(/chk_users_nombre_completo_o_ausente/);
    });

    it('admite cuentas anteriores al desglose, que solo tienen nombre suelto', async () => {
      // Migrar esas filas exigiría adivinar de qué parte viene cada palabra.
      const heredada = await usuarios.save(
        usuarios.create({
          full_name: 'Cuenta Anterior Al Desglose',
          email: 'heredada@test.com',
          password_hash: 'x',
        }),
      );

      expect(heredada.primer_nombre).toBeNull();
      expect(heredada.full_name).toBe('Cuenta Anterior Al Desglose');
    });
  });

  describe('registro de documento', () => {
    it('una cuenta nueva no tiene documento registrado ni nombre asociado', async () => {
      const cuenta = await crearCuenta();

      expect(cuenta.documento_registrado).toBe(false);
      expect(cuenta.nombre_documento).toBeNull();
    });

    it('al registrar el documento guarda el nombre, que es la referencia de la firma', async () => {
      // Sin este dato la confirmación escrita a mano de la declaración jurada no
      // tendría contra qué compararse: antes se descartaba tras validarlo.
      const cuenta = await crearCuenta();

      const actualizada = await service.registrarDocumento(
        cuenta.id,
        'a'.repeat(64),
      );

      expect(actualizada.documento_registrado).toBe(true);
      expect(actualizada.nombre_documento).toBe('María Fernanda Villarroel Quispe');
      expect(actualizada.documento_registrado_en).toBeInstanceOf(Date);
    });

    it('registrar el documento no cambia el nombre de la cuenta', async () => {
      // El formulario del documento ya no vuelve a pedir el nombre, así que no
      // hay forma de que la cuenta termine llamándose distinto de como se creó.
      // El nombre firmado y el mostrado en el perfil son el mismo, siempre.
      const cuenta = await crearCuenta();

      const actualizada = await service.registrarDocumento(
        cuenta.id,
        'd'.repeat(64),
      );

      expect(actualizada.full_name).toBe('María Fernanda Villarroel Quispe');
      expect(actualizada.full_name).toBe(actualizada.nombre_documento);
      expect(actualizada.primer_apellido).toBe('Villarroel');
    });

    it('el documento se guarda solo como hash, nunca en claro', async () => {
      const cuenta = await crearCuenta();
      const hash = 'b'.repeat(64);

      await service.registrarDocumento(cuenta.id, hash);

      const [fila] = await usuarios.query(
        `SELECT ci_hash FROM users WHERE id = $1`,
        [cuenta.id],
      );
      expect(fila.ci_hash).toBe(hash);
    });

    it('un mismo documento no puede registrarse en dos cuentas', async () => {
      // Es la restricción que impide que dos personas compartan identidad, y con
      // ella que una denuncia quede atribuida de forma ambigua.
      const hash = 'c'.repeat(64);
      const primera = await crearCuenta();
      const segunda = await crearCuenta('otra@test.com');

      await service.registrarDocumento(primera.id, hash);

      await expect(
        service.registrarDocumento(segunda.id, hash),
      ).rejects.toThrow();
    });
  });
});
