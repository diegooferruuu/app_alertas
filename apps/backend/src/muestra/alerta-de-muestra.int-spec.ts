import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import {
  AlertaDeMuestra,
  CUENTA_DE_MUESTRA,
  MARGEN_H,
  PERSONA_DE_MUESTRA,
  ZONA_DE_MUESTRA,
} from './alerta-de-muestra';
import { hashDeDocumento } from '../users/domain/documento-identidad';
import { DenunciasService } from '../denuncias/denuncias.service';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { FotografiaDenuncia } from '../denuncias/entities/fotografia-denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { FirmasService } from '../declaraciones/firmas.service';
import { DeclaracionesService } from '../declaraciones/declaraciones.service';
import { DeclaracionJurada } from '../declaraciones/entities/declaracion-jurada.entity';
import { VersionTextoLegal } from '../declaraciones/entities/version-texto-legal.entity';
import { ClaveDispositivo } from '../declaraciones/entities/clave-dispositivo.entity';
import { Prolongacion } from '../declaraciones/entities/prolongacion.entity';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { AlertasService } from '../alertas/alertas.service';
import { SancionesService } from '../sanciones/sanciones.service';
import { Falta } from '../sanciones/entities/falta.entity';
import { Cierre } from '../cierres/entities/cierre.entity';
import { PasarelaPush, PasarelaPushSimulada } from '../alertas/pasarela-push';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { EntregaAlerta } from '../alertas/entities/entrega-alerta.entity';
import { Dispositivo } from '../alertas/entities/dispositivo.entity';

const FOTO = Buffer.from('foto-de-muestra').toString('base64');
const HORA = 3_600_000;

describe('Alerta de muestra para la revisión de Google Play (integración)', () => {
  let ctx: ContextoDePruebas;
  let muestra: AlertaDeMuestra;
  let denunciasService: DenunciasService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let declaraciones: Repository<DeclaracionJurada>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          Denuncia,
          FotografiaDenuncia,
          DeclaracionJurada,
          VersionTextoLegal,
          ClaveDispositivo,
          Prolongacion,
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
        AlertaDeMuestra,
        DenunciasService,
        FirmasService,
        DeclaracionesService,
        UsersService,
        AlertasService,
        SancionesService,
        { provide: PasarelaPush, useClass: PasarelaPushSimulada },
      ],
    });
    muestra = ctx.module.get(AlertaDeMuestra);
    denunciasService = ctx.module.get(DenunciasService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    declaraciones = ctx.module.get(getRepositoryToken(DeclaracionJurada));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => ctx.limpiar());

  /** Lo que el planificador o el paso del tiempo le harían a la alerta. */
  const adelantarVencimiento = (id: string, enHoras: number) =>
    denuncias.update(id, {
      expira_en: new Date(Date.now() + enHoras * HORA),
      ...(enHoras <= 0 ? { estado: EstadoDenuncia.CADUCADA } : {}),
    });

  it('la primera vez crea la cuenta y una alerta firmada que otra cuenta ve en la lista', async () => {
    const { accion, denunciaId, expiraEn } = await muestra.mantener(FOTO);

    expect(accion).toBe('creada');
    const cuenta = await usuarios.findOneByOrFail({ email: CUENTA_DE_MUESTRA.correo });
    expect(cuenta.documento_registrado).toBe(true);
    const denuncia = await denuncias.findOneByOrFail({ id: denunciaId });
    expect(denuncia.denunciante_id).toBe(cuenta.id);
    expect(denuncia.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
    expect(expiraEn.getTime()).toBeGreaterThan(Date.now() + 23 * HORA);
    expect(await declaraciones.countBy({ denuncia_id: denunciaId })).toBe(1);
    expect((await denunciasService.findRecent()).map((d) => d.id)).toEqual([denunciaId]);
    expect(await denunciasService.fotografiasDe(denunciaId)).toHaveLength(1);
  });

  it('no toca una alerta a la que le quedan más horas que el margen', async () => {
    const primera = await muestra.mantener(FOTO);
    await adelantarVencimiento(primera.denunciaId, MARGEN_H + 1);

    const segunda = await muestra.mantener(FOTO);

    expect(segunda.accion).toBe('vigente');
    expect(segunda.denunciaId).toBe(primera.denunciaId);
    expect(await denuncias.count()).toBe(1);
    expect(await usuarios.count()).toBe(1);
  });

  it('prolonga, sin notificar, la que entra en sus últimas horas', async () => {
    const primera = await muestra.mantener(FOTO);
    await adelantarVencimiento(primera.denunciaId, MARGEN_H - 1);

    const segunda = await muestra.mantener(FOTO);

    expect(segunda.accion).toBe('prolongada');
    expect(segunda.denunciaId).toBe(primera.denunciaId);
    expect(segunda.expiraEn.getTime()).toBeGreaterThan(Date.now() + 23 * HORA);
    const denuncia = await denuncias.findOneByOrFail({ id: primera.denunciaId });
    expect(denuncia.prolongaciones).toBe(1);
  });

  it('prolonga también la que ya venció', async () => {
    const primera = await muestra.mantener(FOTO);
    await adelantarVencimiento(primera.denunciaId, -1);

    const segunda = await muestra.mantener(FOTO);

    expect(segunda.accion).toBe('prolongada');
    const denuncia = await denuncias.findOneByOrFail({ id: primera.denunciaId });
    expect(denuncia.estado).toBe(EstadoDenuncia.ACTIVA);
  });

  it('sin prolongaciones, la da por encontrada y presenta otra', async () => {
    const primera = await muestra.mantener(FOTO);
    await denuncias.update(primera.denunciaId, { prolongaciones: 3 });
    await adelantarVencimiento(primera.denunciaId, 1);

    const segunda = await muestra.mantener(FOTO);

    expect(segunda.accion).toBe('renovada');
    expect(segunda.denunciaId).not.toBe(primera.denunciaId);
    const vieja = await denuncias.findOneByOrFail({ id: primera.denunciaId });
    expect(vieja.estado).toBe(EstadoDenuncia.CERRADA);
    expect((await denunciasService.findRecent()).map((d) => d.id)).toEqual([segunda.denunciaId]);
  });

  it('firma la que una corrida cortada dejó sin firmar, en vez de presentar otra', async () => {
    const primera = await muestra.mantener(FOTO);
    const cuenta = await usuarios.findOneByOrFail({ email: CUENTA_DE_MUESTRA.correo });
    await denunciasService.darPorEncontrada(cuenta.id, primera.denunciaId);
    const sinFirmar = await denuncias.save(
      denuncias.create({
        denunciante_id: cuenta.id,
        nombre_persona_buscada: PERSONA_DE_MUESTRA.nombre,
        ci_hash_persona_buscada: hashDeDocumento(PERSONA_DE_MUESTRA.carnet),
        ...ZONA_DE_MUESTRA,
        nivel_confianza: NivelConfianza.REGISTRADA,
        estado: EstadoDenuncia.ACTIVA,
      })
    );

    const resultado = await muestra.mantener(FOTO);

    expect(resultado.accion).toBe('creada');
    expect(resultado.denunciaId).toBe(sinFirmar.id);
    expect(await denuncias.count()).toBe(2);
  });

  it('no revive una cuenta de muestra eliminada', async () => {
    await muestra.mantener(FOTO);
    await usuarios.update({ email: CUENTA_DE_MUESTRA.correo }, { deleted_at: new Date() });

    await expect(muestra.mantener(FOTO)).rejects.toThrow('fue eliminada');
  });
});
