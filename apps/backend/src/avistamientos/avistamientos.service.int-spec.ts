import { Logger } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { AvistamientosService } from './avistamientos.service';
import { UsoCanalAvistamiento } from './entities/uso-canal-avistamiento.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { User } from '../users/entities/user.entity';

/**
 * El registro del uso de un canal de avistamiento, contra Postgres real.
 *
 * Lo que importa aquí es lo que **no** queda escrito: ni quién, ni dónde, ni
 * cuándo exactamente (I2).
 */
describe('Uso del canal de avistamiento (integración)', () => {
  let ctx: ContextoDePruebas;
  let servicio: AvistamientosService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let usos: Repository<UsoCanalAvistamiento>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [TypeOrmModule.forFeature([UsoCanalAvistamiento, Denuncia, User])],
      providers: [AvistamientosService],
    });
    servicio = ctx.module.get(AvistamientosService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    usos = ctx.module.get(getRepositoryToken(UsoCanalAvistamiento));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => ctx.limpiar());

  const hashDe = (texto: string) => createHash('sha256').update(texto).digest('hex');

  /** Cada denuncia con su propio autor y su propia persona buscada. */
  let creadas = 0;
  const crearDenuncia = async (
    estado = EstadoDenuncia.ACTIVA,
    nivel = NivelConfianza.PROVISIONAL,
  ) => {
    const n = ++creadas;
    const autor = await usuarios.save(
      usuarios.create({
        full_name: 'Ana Quispe',
        email: `autora${n}@test.com`,
        password_hash: 'x',
        documento_registrado: true,
        ci_hash: hashDe(`autora-${n}`),
      }),
    );
    const difundible = nivel !== NivelConfianza.REGISTRADA;
    return denuncias.save(
      denuncias.create({
        denunciante_id: autor.id,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: hashDe(`buscada-${n}`),
        description: 'Visto por última vez el martes',
        latitude: -17.38,
        longitude: -66.15,
        nivel_confianza: nivel,
        estado,
        radio_actual_m: difundible ? 2000 : null,
        expira_en: difundible ? new Date(Date.now() + 3_600_000) : null,
      }),
    );
  };

  it('anota el toque sobre una alerta difundida', async () => {
    const denuncia = await crearDenuncia();

    await servicio.registrarUsoDeCanal(denuncia.id, 'LLAMADA');
    await servicio.registrarUsoDeCanal(denuncia.id, 'MENSAJE');

    const filas = await usos.find({ where: { denuncia_id: denuncia.id } });
    expect(filas.map((f) => f.canal).sort()).toEqual(['LLAMADA', 'MENSAJE']);
  });

  it('la tabla no tiene dónde guardar a la persona, el lugar ni la hora del avistamiento (I2)', async () => {
    // Se comprueba el esquema y no solo lo que escribe el servicio: el riesgo
    // es la columna que alguien agregue mañana.
    const columnas: Array<{ column_name: string }> = await usos.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_name = 'usos_canal_avistamiento' ORDER BY column_name`,
    );

    expect(columnas.map((c) => c.column_name)).toEqual([
      'canal',
      'creado_en',
      'denuncia_id',
      'id',
    ]);
  });

  it('la hora queda truncada al minuto', async () => {
    const denuncia = await crearDenuncia();

    await servicio.registrarUsoDeCanal(denuncia.id, 'LLAMADA');

    const [fila] = await usos.query(
      `SELECT EXTRACT(SECOND FROM creado_en)::float AS segundos FROM usos_canal_avistamiento`,
    );
    expect(fila.segundos).toBe(0);
  });

  it('la base rechaza una hora con segundos aunque se escriba directo', async () => {
    const denuncia = await crearDenuncia();

    await expect(
      usos.query(
        `INSERT INTO usos_canal_avistamiento (denuncia_id, canal, creado_en)
         VALUES ($1, 'LLAMADA', '2026-10-01 10:00:30-04')`,
        [denuncia.id],
      ),
    ).rejects.toThrow(/chk_usos_canal_al_minuto/);
  });

  it('la base rechaza un canal que la app no tiene', async () => {
    const denuncia = await crearDenuncia();

    await expect(
      usos.query(
        `INSERT INTO usos_canal_avistamiento (denuncia_id, canal) VALUES ($1, 'CORREO')`,
        [denuncia.id],
      ),
    ).rejects.toThrow(/chk_usos_canal_canal/);
  });

  it('también cuenta sobre una alerta vencida: la persona puede seguir desaparecida', async () => {
    const denuncia = await crearDenuncia(EstadoDenuncia.CADUCADA);

    await servicio.registrarUsoDeCanal(denuncia.id, 'LLAMADA');

    expect(await usos.count()).toBe(1);
  });

  it('no anota nada sobre una alerta sin firmar, cerrada o inexistente, y responde igual', async () => {
    // Una cerrada no se puede seguir reportando: la persona dijo que está bien,
    // o que la denuncia era falsa, y nadie debería seguir buscándola.
    const sinFirmar = await crearDenuncia(EstadoDenuncia.ACTIVA, NivelConfianza.REGISTRADA);
    const cerrada = await crearDenuncia(EstadoDenuncia.INVALIDADA);

    for (const id of [sinFirmar.id, cerrada.id, '00000000-0000-4000-8000-000000000000']) {
      await expect(servicio.registrarUsoDeCanal(id, 'LLAMADA')).resolves.toBeUndefined();
    }
    expect(await usos.count()).toBe(0);
  });

  it('no escribe nada en el registro de la aplicación', async () => {
    const espias = (['log', 'debug', 'warn', 'error', 'verbose'] as const).map((nivel) =>
      jest.spyOn(Logger.prototype, nivel).mockImplementation(() => {}),
    );
    try {
      const denuncia = await crearDenuncia();

      await servicio.registrarUsoDeCanal(denuncia.id, 'MENSAJE');

      for (const espia of espias) expect(espia).not.toHaveBeenCalled();
    } finally {
      espias.forEach((espia) => espia.mockRestore());
    }
  });
});
