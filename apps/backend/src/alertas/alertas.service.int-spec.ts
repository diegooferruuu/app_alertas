import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { AlertasService } from './alertas.service';
import { DispositivosService } from './dispositivos.service';
import { UbicacionService } from './ubicacion.service';
import { PasarelaPush, PasarelaPushSimulada } from './pasarela-push';
import { Dispositivo } from './entities/dispositivo.entity';
import { EmisionAlerta } from './entities/emision-alerta.entity';
import { EntregaAlerta } from './entities/entrega-alerta.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { User } from '../users/entities/user.entity';

const LA_PAZ = { lat: -16.5, lng: -68.15 };
/** Un grado de latitud son unos 111 km: muy lejos de cualquier radio urbano. */
const MUY_LEJOS = { lat: -15.5, lng: -68.15 };

describe('Emisión de alertas (integración)', () => {
  let ctx: ContextoDePruebas;
  let alertas: AlertasService;
  let dispositivos: DispositivosService;
  let ubicacion: UbicacionService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let emisiones: Repository<EmisionAlerta>;
  let entregas: Repository<EntregaAlerta>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          Dispositivo,
          EmisionAlerta,
          EntregaAlerta,
          Denuncia,
          User,
        ]),
      ],
      providers: [
        AlertasService,
        DispositivosService,
        UbicacionService,
        { provide: PasarelaPush, useClass: PasarelaPushSimulada },
      ],
    });
    alertas = ctx.module.get(AlertasService);
    dispositivos = ctx.module.get(DispositivosService);
    ubicacion = ctx.module.get(UbicacionService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    emisiones = ctx.module.get(getRepositoryToken(EmisionAlerta));
    entregas = ctx.module.get(getRepositoryToken(EntregaAlerta));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => ctx.limpiar());

  const crearUsuario = async (email: string) =>
    usuarios.save(
      usuarios.create({
        full_name: 'Persona ' + email,
        email,
        password_hash: 'x',
        documento_registrado: true,
        ci_hash: createHash('sha256').update(email).digest('hex'),
      }),
    );

  /** Un vecino con dispositivo y ubicación reciente: alertable. */
  const crearVecino = async (
    email: string,
    punto = LA_PAZ,
    plataforma: 'android' | 'ios' = 'android',
  ) => {
    const usuario = await crearUsuario(email);
    await dispositivos.registrar(usuario.id, `token-${email}`, plataforma);
    await ubicacion.actualizar(usuario.id, punto.lat, punto.lng);
    return usuario;
  };

  const crearDenunciaDifundida = async (autorId: string, radioM = 2000) =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: 'b'.repeat(64),
        description: 'Visto por última vez el martes',
        latitude: LA_PAZ.lat,
        longitude: LA_PAZ.lng,
        nivel_confianza: NivelConfianza.PROVISIONAL,
        estado: EstadoDenuncia.ACTIVA,
        radio_actual_m: radioM,
        expira_en: new Date(Date.now() + 86_400_000),
      }),
    );

  describe('dispositivos', () => {
    it('una persona puede tener varios dispositivos', async () => {
      const usuario = await crearUsuario('multi@test.com');

      await dispositivos.registrar(usuario.id, 'token-telefono', 'android');
      await dispositivos.registrar(usuario.id, 'token-tablet', 'ios');

      expect(await dispositivos.deUsuario(usuario.id)).toHaveLength(2);
    });

    it('un token reasignado cambia de dueño en vez de duplicarse', async () => {
      // Si alguien inicia sesión con otra cuenta en el mismo teléfono, la
      // persona anterior no debe seguir recibiendo alertas en ese aparato.
      const primera = await crearUsuario('primera@test.com');
      const segunda = await crearUsuario('segunda@test.com');

      await dispositivos.registrar(primera.id, 'mismo-token', 'android');
      await dispositivos.registrar(segunda.id, 'mismo-token', 'android');

      expect(await dispositivos.deUsuario(primera.id)).toHaveLength(0);
      expect(await dispositivos.deUsuario(segunda.id)).toHaveLength(1);
    });
  });

  describe('a quién alcanza la alerta', () => {
    it('alcanza a quien está dentro del radio del caso', async () => {
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);

      const destinatarios = await alertas.destinatariosDe(denuncia);

      expect(destinatarios).toHaveLength(1);
      expect(destinatarios[0].distancia_m).toBe(0);
    });

    it('no alcanza a quien está fuera del radio', async () => {
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('lejano@test.com', MUY_LEJOS);
      const denuncia = await crearDenunciaDifundida(autor.id);

      expect(await alertas.destinatariosDe(denuncia)).toHaveLength(0);
    });

    it('usa el radio de la denuncia, no una constante del sistema', async () => {
      // Al corroborarse el radio se amplía; la consulta no debe reescribirse.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('lejano@test.com', MUY_LEJOS);
      const denuncia = await crearDenunciaDifundida(autor.id, 2000);

      expect(await alertas.destinatariosDe(denuncia)).toHaveLength(0);

      denuncia.radio_actual_m = 200_000;
      expect(await alertas.destinatariosDe(denuncia)).toHaveLength(1);
    });

    it('excluye a quien no reporta ubicación desde hace demasiado', async () => {
      const autor = await crearUsuario('autor@test.com');
      const olvidado = await crearVecino('olvidado@test.com');
      // Por defecto se descarta a partir de 72 h.
      await usuarios.update(olvidado.id, {
        last_location_at: new Date(Date.now() - 100 * 3_600_000),
      });
      const denuncia = await crearDenunciaDifundida(autor.id);

      expect(await alertas.destinatariosDe(denuncia)).toHaveLength(0);
    });

    it('excluye a quien no tiene ningún dispositivo registrado', async () => {
      const autor = await crearUsuario('autor@test.com');
      const sinDispositivo = await crearUsuario('sindisp@test.com');
      await ubicacion.actualizar(sinDispositivo.id, LA_PAZ.lat, LA_PAZ.lng);
      const denuncia = await crearDenunciaDifundida(autor.id);

      expect(await alertas.destinatariosDe(denuncia)).toHaveLength(0);
    });

    it('no alerta a quien denunció: ya conoce el caso', async () => {
      const autor = await crearVecino('autor@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);

      expect(await alertas.destinatariosDe(denuncia)).toHaveLength(0);
    });

    it('alcanza los dos dispositivos de la misma persona', async () => {
      const autor = await crearUsuario('autor@test.com');
      const vecino = await crearVecino('vecino@test.com');
      await dispositivos.registrar(vecino.id, 'segundo-aparato', 'ios');
      const denuncia = await crearDenunciaDifundida(autor.id);

      expect(await alertas.destinatariosDe(denuncia)).toHaveLength(2);
    });
  });

  describe('procesamiento de la cola', () => {
    const encolarPara = async (denunciaId: string, radioM = 2000) =>
      ctx.dataSource.transaction((manager) =>
        alertas.encolar(manager, denunciaId, radioM, 'firma'),
      );

    it('procesa una emisión pendiente y registra a cuántos alcanzó', async () => {
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino1@test.com');
      await crearVecino('vecino2@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      expect(await alertas.procesarPendientes()).toBe(1);

      const [emision] = await emisiones.find();
      expect(emision.estado).toBe('completada');
      expect(emision.destinatarios).toBe(2);
      expect(emision.emitida_en).toBeInstanceOf(Date);
    });

    it('registra una entrega por destinatario con su distancia', async () => {
      // `distancia_m` es lo que permite comprobar después que nadie dentro del
      // radio quedó sin avisar.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      await alertas.procesarPendientes();

      const registradas = await entregas.find();
      expect(registradas).toHaveLength(1);
      expect(registradas[0].estado).toBe('aceptada');
      expect(registradas[0].distancia_m).toBe(0);
    });

    it('permite medir la latencia entre encolar y emitir', async () => {
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      await alertas.procesarPendientes();

      const [emision] = await emisiones.find();
      const latenciaMs =
        emision.emitida_en!.getTime() - emision.creada_en.getTime();
      expect(latenciaMs).toBeGreaterThanOrEqual(0);
    });

    it('descarta la emisión si la denuncia caducó antes de procesarse', async () => {
      // Entre encolar y procesar puede pasar cualquier cosa. Emitir una alerta
      // que ya no debe difundirse es exactamente lo que el diseño impide.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      await denuncias.update(denuncia.id, { estado: EstadoDenuncia.CADUCADA });
      await alertas.procesarPendientes();

      const [emision] = await emisiones.find();
      expect(emision.destinatarios).toBe(0);
      expect(await entregas.count()).toBe(0);
    });

    it('no vuelve a procesar una emisión ya completada', async () => {
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      await alertas.procesarPendientes();
      expect(await alertas.procesarPendientes()).toBe(0);
      expect(await entregas.count()).toBe(1);
    });

    it('una emisión sin destinatarios se completa igual, sin entregas', async () => {
      const autor = await crearUsuario('autor@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      await alertas.procesarPendientes();

      const [emision] = await emisiones.find();
      expect(emision.estado).toBe('completada');
      expect(emision.destinatarios).toBe(0);
    });
  });
});
