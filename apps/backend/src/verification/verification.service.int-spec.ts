import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcryptjs from 'bcryptjs';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { VerificationService } from './verification.service';
import { LectorDeDocumento, LectorDeDocumentoSimulado } from './documento/lector-de-documento';
import { ComparadorDeRostros, ComparadorDeRostrosSimulado } from './rostros/comparador-de-rostros';
import { UsersService } from '../users/users.service';
import { CuentasService } from '../users/cuentas.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { hashDeDocumento } from '../users/domain/documento-identidad';
import { DocumentoBloqueado } from '../sanciones/entities/documento-bloqueado.entity';
import { AlertasService } from '../alertas/alertas.service';

const CI = '8472913';
const NOMBRE = 'Ana Rocío Quispe Mamani';
const CONTRASENA = 'contrasena-de-prueba';
const IMAGEN = Buffer.from('imagen').toString('base64');

describe('Registro de documento de un carnet que ya tuvo cuenta (integración)', () => {
  let ctx: ContextoDePruebas;
  let servicio: VerificationService;
  let cuentas: CuentasService;
  let usersService: UsersService;
  let usuarios: Repository<User>;
  const avisarPersonaReportada = jest.fn(async () => 0);

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [TypeOrmModule.forFeature([User, RefreshToken, DocumentoBloqueado])],
      providers: [
        VerificationService,
        UsersService,
        CuentasService,
        { provide: AlertasService, useValue: { avisarPersonaReportada } },
        // El carnet «dice» el número y el nombre; el rostro siempre coincide.
        {
          provide: LectorDeDocumento,
          useValue: new LectorDeDocumentoSimulado(
            `ESTADO PLURINACIONAL DE BOLIVIA ${NOMBRE} ${CI}`
          ),
        },
        { provide: ComparadorDeRostros, useValue: new ComparadorDeRostrosSimulado() },
      ],
    });
    servicio = ctx.module.get(VerificationService);
    cuentas = ctx.module.get(CuentasService);
    usersService = ctx.module.get(UsersService);
    usuarios = ctx.module.get(getRepositoryToken(User));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => {
    await ctx.limpiar();
    avisarPersonaReportada.mockClear();
  });

  const crearCuenta = async (email: string) =>
    usersService.create({
      email,
      password_hash: await bcryptjs.hash(CONTRASENA, 4),
      phone: '70000000',
      primer_nombre: 'Ana',
      segundo_nombre: 'Rocío',
      primer_apellido: 'Quispe',
      segundo_apellido: 'Mamani',
    });

  const registrar = (userId: string) =>
    servicio.registrarDocumento(userId, IMAGEN, IMAGEN, IMAGEN, { ci_number: CI } as any);

  it('recupera la cuenta eliminada de ese carnet en vez de rechazarlo', async () => {
    const vieja = await crearCuenta('ana@test.bo');
    await registrar(vieja.id);
    await cuentas.eliminar(vieja.id, CONTRASENA);
    const nueva = await crearCuenta('ana.otra@test.bo');

    // El paso previo tampoco lo rechaza: es el mismo carnet que vuelve.
    await expect(
      servicio.extraerDatosDocumento(nueva.id, IMAGEN, IMAGEN, { ci_number: CI } as any)
    ).resolves.toMatchObject({ coincide: true });
    const resultado = await registrar(nueva.id);

    expect(resultado).toMatchObject({ documento_registrado: true, cuenta_recuperada: true });
    expect(resultado.message).toContain('vuelve a iniciar sesión');
    const recuperada = await usersService.findByEmail('ana.otra@test.bo');
    expect(recuperada?.id).toBe(vieja.id);
    expect(recuperada?.ci_hash).toBe(hashDeDocumento(CI));
    // El aviso de denuncias sobre el documento va a la cuenta que quedó.
    expect(avisarPersonaReportada).toHaveBeenCalledWith(vieja.id, hashDeDocumento(CI));
  });

  it('un carnet de una cuenta viva se sigue rechazando', async () => {
    const duena = await crearCuenta('ana@test.bo');
    await registrar(duena.id);
    const otra = await crearCuenta('otra@test.bo');

    await expect(registrar(otra.id)).rejects.toThrow(BadRequestException);
    expect(await usersService.estaActiva(duena.id)).toBe(true);
    expect((await usuarios.findOneByOrFail({ id: otra.id })).documento_registrado).toBe(false);
  });

  it('un registro normal no dice que se recuperó nada', async () => {
    const cuenta = await crearCuenta('ana@test.bo');

    const resultado = await registrar(cuenta.id);

    expect(resultado).toMatchObject({ documento_registrado: true, cuenta_recuperada: false });
  });
});
