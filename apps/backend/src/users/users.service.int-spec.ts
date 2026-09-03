import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ReputationEvent } from './entities/reputation-event.entity';

describe('UsersService · registro de documento (integración)', () => {
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

  const crearCuenta = () =>
    usuarios.save(
      usuarios.create({
        full_name: 'María Fernanda Villarroel Quispe',
        email: 'maria@test.com',
        password_hash: 'x',
      }),
    );

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
      'María Fernanda Villarroel Quispe',
    );

    expect(actualizada.documento_registrado).toBe(true);
    expect(actualizada.nombre_documento).toBe('María Fernanda Villarroel Quispe');
    expect(actualizada.documento_registrado_en).toBeInstanceOf(Date);
  });

  it('el nombre verificado reemplaza al que se tecleó al crear la cuenta', async () => {
    // El nombre de registro no lo comprueba nadie. Si quedaran ambos, la
    // declaración jurada se firmaría con uno y el perfil mostraría el otro.
    const cuenta = await usuarios.save(
      usuarios.create({
        full_name: 'Nombre Sin Comprobar',
        email: 'sinverificar@test.com',
        password_hash: 'x',
      }),
    );

    const actualizada = await service.registrarDocumento(
      cuenta.id,
      'd'.repeat(64),
      'María Fernanda Villarroel Quispe',
    );

    expect(actualizada.full_name).toBe('María Fernanda Villarroel Quispe');
    expect(actualizada.full_name).toBe(actualizada.nombre_documento);
  });

  it('el documento se guarda solo como hash, nunca en claro', async () => {
    const cuenta = await crearCuenta();
    const hash = 'b'.repeat(64);

    await service.registrarDocumento(cuenta.id, hash, 'María Villarroel');

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
    const segunda = await usuarios.save(
      usuarios.create({
        full_name: 'Otra Persona',
        email: 'otra@test.com',
        password_hash: 'x',
      }),
    );

    await service.registrarDocumento(primera.id, hash, 'María Villarroel');

    await expect(
      service.registrarDocumento(segunda.id, hash, 'Otra Persona'),
    ).rejects.toThrow();
  });
});
