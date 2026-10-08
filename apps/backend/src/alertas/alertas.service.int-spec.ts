import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { AlertasService, LOTE_DE_ENVIO, LOTE_DE_RECIBOS } from './alertas.service';
import { DispositivosService } from './dispositivos.service';
import { UbicacionService } from './ubicacion.service';
import {
  MensajePush,
  PasarelaPush,
  Recibo,
  ResultadoEnvio,
} from './pasarela-push';
import { Dispositivo } from './entities/dispositivo.entity';
import { EmisionAlerta } from './entities/emision-alerta.entity';
import { EntregaAlerta } from './entities/entrega-alerta.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { User } from '../users/entities/user.entity';

const LA_PAZ = { lat: -16.5, lng: -68.15 };
/** Un grado de latitud son unos 111 km: muy lejos de cualquier radio urbano. */
const MUY_LEJOS = { lat: -15.5, lng: -68.15 };

/**
 * Doble de la pasarela al que se le puede dictar la respuesta.
 *
 * Por defecto acepta todo, igual que `PasarelaPushSimulada`. Se usa uno propio
 * porque hay respuestas —un token desinstalado— que el servicio tiene que
 * atender y que la simulada no sabe producir.
 */
class PasarelaProgramable extends PasarelaPush {
  /** Tokens que la pasarela reportará como aparatos que ya no existen. */
  desinstalados = new Set<string>();

  /**
   * Cada token al que se le mandó algo, una vez por envío.
   *
   * Es lo que ve la gente: si un token aparece dos veces, ese teléfono recibió
   * la misma alerta dos veces.
   */
  envios: string[] = [];

  /**
   * Si se fija, la llamada con ese número (desde 1) entrega y **después** lanza.
   *
   * Es el caso que importa: la pasarela tomó los mensajes y pudieron llegar,
   * pero quien envía no recibió la confirmación. Desde el servicio no hay forma
   * de saber si esos teléfonos se enteraron.
   */
  fallarEnLlamada: number | null = null;
  private llamadas = 0;

  /** Recibos que devolverá, por ticket. Un ticket sin entrada: todavía no está listo. */
  recibos = new Map<string, Recibo>();

  /** Si se fija, todo ticket sin recibo dictado vuelve como despachado. */
  todosDespachados = false;

  /** Los tickets por los que se preguntó, una lista por consulta. */
  consultas: string[][] = [];

  reiniciar(): void {
    this.desinstalados.clear();
    this.envios = [];
    this.fallarEnLlamada = null;
    this.llamadas = 0;
    this.recibos.clear();
    this.todosDespachados = false;
    this.consultas = [];
  }

  async consultarRecibos(ticketIds: string[]): Promise<Map<string, Recibo>> {
    this.consultas.push(ticketIds);
    const respuesta = new Map<string, Recibo>();
    for (const id of ticketIds) {
      const recibo =
        this.recibos.get(id) ??
        (this.todosDespachados ? { despachado: true, detalle: 'ok' } : undefined);
      if (recibo) respuesta.set(id, recibo);
    }
    return respuesta;
  }

  async enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio[]> {
    this.llamadas++;
    this.envios.push(...mensajes.map((m) => m.push_token));
    if (this.llamadas === this.fallarEnLlamada) {
      throw new Error('la pasarela se cayó después de entregar');
    }

    return mensajes.map((m) =>
      this.desinstalados.has(m.push_token)
        ? {
            push_token: m.push_token,
            aceptado: false,
            detalle: 'DeviceNotRegistered',
            token_invalido: true,
          }
        : // El detalle y el ticket llevan el token: así una prueba puede comprobar
          // que cada resultado quedó escrito en la fila de su destinatario y no
          // en la de otro. Con valores fijos, un cruce de filas pasaría inadvertido.
          {
            push_token: m.push_token,
            aceptado: true,
            ticket_id: `ticket-${m.push_token}`,
            detalle: `ticket ${m.push_token}`,
          },
    );
  }
}

describe('Emisión de alertas (integración)', () => {
  let ctx: ContextoDePruebas;
  let alertas: AlertasService;
  let dispositivos: DispositivosService;
  let ubicacion: UbicacionService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let emisiones: Repository<EmisionAlerta>;
  let entregas: Repository<EntregaAlerta>;
  let aparatos: Repository<Dispositivo>;
  let pasarela: PasarelaProgramable;

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
        { provide: PasarelaPush, useClass: PasarelaProgramable },
      ],
    });
    alertas = ctx.module.get(AlertasService);
    pasarela = ctx.module.get(PasarelaPush);
    aparatos = ctx.module.get(getRepositoryToken(Dispositivo));
    dispositivos = ctx.module.get(DispositivosService);
    ubicacion = ctx.module.get(UbicacionService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    emisiones = ctx.module.get(getRepositoryToken(EmisionAlerta));
    entregas = ctx.module.get(getRepositoryToken(EntregaAlerta));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => {
    await ctx.limpiar();
    pasarela.reiniciar();
  });

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

  /**
   * Cada denuncia busca a una persona distinta: un mismo autor no puede tener
   * dos denuncias abiertas sobre la misma persona, y la base lo impide.
   */
  let personasBuscadas = 0;
  const crearDenunciaDifundida = async (autorId: string, radioM = 2000) =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: createHash('sha256')
          .update(`buscada-${++personasBuscadas}`)
          .digest('hex'),
        description: 'Visto por última vez el martes',
        latitude: LA_PAZ.lat,
        longitude: LA_PAZ.lng,
        nivel_confianza: NivelConfianza.PROVISIONAL,
        estado: EstadoDenuncia.ACTIVA,
        radio_actual_m: radioM,
        expira_en: new Date(Date.now() + 86_400_000),
      }),
    );

  /**
   * Crea `n` vecinos alertables en dos sentencias y no uno a uno.
   *
   * Por el camino normal —cuenta, dispositivo y ubicación, cada uno con su
   * viaje a la base— veinte mil vecinos tardarían minutos solo en prepararse.
   * Aquí se generan con `generate_series` en el servidor. Todos en el mismo
   * punto que la denuncia: lo que se prueba es el registro de entregas, no la
   * geometría, que ya está cubierta arriba.
   */
  const sembrarVecinos = async (n: number) => {
    await ctx.dataSource.query(
      `INSERT INTO users (full_name, email, password_hash, documento_registrado,
                          ci_hash, last_location, last_location_at)
       SELECT 'Vecino ' || n, 'vecino' || n || '@carga.test', 'x', true,
              encode(sha256(('carga-' || n)::bytea), 'hex'),
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, now()
         FROM generate_series(1, $3) AS n`,
      [LA_PAZ.lng, LA_PAZ.lat, n],
    );
    await ctx.dataSource.query(
      `INSERT INTO dispositivos (usuario_id, push_token, plataforma, ultima_actividad)
       SELECT id, 'ExponentPushToken[' || email || ']', 'android', now()
         FROM users WHERE email LIKE '%@carga.test'`,
    );
  };

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

    it('descarta la emisión de una alerta vencida aunque el planificador no la haya marcado', async () => {
      // Al volver de una caída de más de un día el worker corre antes que el
      // planificador y encuentra la alerta ACTIVA con el plazo cumplido. Lo que
      // manda es el plazo, como en el mapa y en la lista.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      await denuncias.update(denuncia.id, { expira_en: new Date(Date.now() - 1000) });
      await alertas.procesarPendientes();

      const [emision] = await emisiones.find();
      expect(emision.estado).toBe('completada');
      expect(emision.destinatarios).toBe(0);
      expect(emision.ultimo_error).toBe('descartada: la alerta venció antes de emitirse');
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

  /**
   * Limpieza de aparatos que la pasarela reporta desinstalados.
   *
   * Sin esto, cada desinstalación deja un token que falla en toda emisión futura.
   * No es solo ruido: la tasa de entrega es una de las métricas de validación del
   * proyecto, y se hundiría con fallos que no dicen nada del sistema.
   */
  describe('aparatos desinstalados', () => {
    const encolarPara = async (denunciaId: string, radioM = 2000) =>
      ctx.dataSource.transaction((manager) =>
        alertas.encolar(manager, denunciaId, radioM, 'firma'),
      );

    it('da de baja el aparato cuyo token ya no existe', async () => {
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('sigue@test.com');
      await crearVecino('desinstalo@test.com');
      pasarela.desinstalados.add('token-desinstalo@test.com');

      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await alertas.procesarPendientes();

      const vivos = await aparatos.find();
      expect(vivos).toHaveLength(1);
      expect(vivos[0].push_token).toBe('token-sigue@test.com');
    });

    it('la entrega fallida sobrevive a la baja del aparato', async () => {
      // `entregas_alerta.dispositivo_id` no tiene clave foránea hacia
      // `dispositivos` justamente para esto: el rastro de a quién se intentó
      // alcanzar y con qué resultado es auditoría y no puede borrarse porque el
      // teléfono desapareciera.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('desinstalo@test.com');
      pasarela.desinstalados.add('token-desinstalo@test.com');

      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await alertas.procesarPendientes();

      expect(await aparatos.count()).toBe(0);

      const registradas = await entregas.find();
      expect(registradas).toHaveLength(1);
      expect(registradas[0].estado).toBe('fallida');
      expect(registradas[0].resultado_pasarela).toBe('DeviceNotRegistered');
    });

    it('un fallo que no es de token no da de baja nada', async () => {
      // La pasarela por defecto acepta; aquí nadie está desinstalado, así que
      // ningún aparato debe desaparecer. Es el control de que la baja se dispara
      // por `token_invalido` y no por cualquier fallo.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');

      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await alertas.procesarPendientes();

      expect(await aparatos.count()).toBe(1);
    });

    it('quien reinstala vuelve a recibir alertas', async () => {
      // La baja no es un castigo permanente: el registro del aparato ocurre en
      // cada arranque de la aplicación, así que reinstalar devuelve a la persona
      // al alcance de las alertas con un token nuevo.
      const autor = await crearUsuario('autor@test.com');
      const vecino = await crearVecino('reinstala@test.com');
      pasarela.desinstalados.add('token-reinstala@test.com');

      const primera = await crearDenunciaDifundida(autor.id);
      await encolarPara(primera.id);
      await alertas.procesarPendientes();
      expect(await aparatos.count()).toBe(0);

      // Reinstala: token nuevo, y la ubicación sigue siendo reciente.
      await dispositivos.registrar(vecino.id, 'token-nuevo', 'android');

      const segunda = await crearDenunciaDifundida(autor.id);
      await encolarPara(segunda.id);
      await alertas.procesarPendientes();

      // Se cuenta por estado y no por «la última»: `id` es un uuid, así que
      // ordenar por él no da orden cronológico ninguno.
      expect(await entregas.count()).toBe(2);
      expect(await entregas.countBy({ estado: 'aceptada' })).toBe(1);
      expect(await aparatos.count()).toBe(1);
    });
  });

  /**
   * Emisiones a escala de ciudad.
   *
   * A 200 000 usuarios en la mancha urbana de Cochabamba —unos 670 por km²— un
   * radio de 2 km alcanza a ~8 400 personas y uno de 10 km a la ciudad entera.
   * Estas pruebas fijan que el registro de entregas aguante esas cifras.
   */
  describe('a escala de ciudad', () => {
    const encolarPara = async (denunciaId: string, radioM = 2000) =>
      ctx.dataSource.transaction((manager) =>
        alertas.encolar(manager, denunciaId, radioM, 'firma'),
      );

    it('registra completa una emisión a 20 000 destinatarios', async () => {
      // Por encima del techo que tenía el INSERT único: 5 columnas por fila
      // contra los 65 535 parámetros que admite una sentencia de PostgreSQL
      // daban ~13 100 filas como máximo, o sea un radio de ~2,5 km a densidad
      // de ciudad. Pasado eso la emisión fallaba entera y no avisaba a nadie.
      const N = 20_000;
      const autor = await crearUsuario('autor@test.com');
      await sembrarVecinos(N);

      // Uno de cada siete, desinstalado: la actualización tiene que repartir dos
      // estados distintos y dar de baja un bloque grande de aparatos a la vez.
      const tokens: Array<{ push_token: string }> = await ctx.dataSource.query(
        `SELECT push_token FROM dispositivos ORDER BY push_token`,
      );
      tokens.forEach(({ push_token }, i) => {
        if (i % 7 === 0) pasarela.desinstalados.add(push_token);
      });
      const muertos = pasarela.desinstalados.size;

      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await alertas.procesarPendientes();

      const [emision] = await emisiones.find();
      expect(emision.ultimo_error).toBeNull();
      expect(emision.estado).toBe('completada');
      expect(emision.destinatarios).toBe(N);

      // Una fila por destinatario, y ninguna olvidada en «encolada».
      expect(await entregas.count()).toBe(N);
      expect(await entregas.countBy({ estado: 'aceptada' })).toBe(N - muertos);
      expect(await entregas.countBy({ estado: 'fallida' })).toBe(muertos);
      expect(await entregas.countBy({ estado: 'encolada' })).toBe(0);

      // Cada resultado en la fila de su destinatario. El doble escribe el token
      // en el detalle, así que un cruce de filas aparecería aquí.
      const [{ cruzadas }] = await ctx.dataSource.query(
        `SELECT count(*)::int AS cruzadas
           FROM entregas_alerta e JOIN dispositivos d ON d.id = e.dispositivo_id
          WHERE e.resultado_pasarela <> 'ticket ' || d.push_token`,
      );
      expect(cruzadas).toBe(0);
      expect(
        await entregas.countBy({ resultado_pasarela: 'DeviceNotRegistered' }),
      ).toBe(muertos);

      // `actualizada_en` la movía TypeORM solo, por ser `@UpdateDateColumn`. Una
      // actualización escrita a mano tiene que moverla ella; si no, la marca se
      // queda en la hora de inserción y cualquier medida de latencia de entrega
      // sale en cero.
      const [{ sin_marca }] = await ctx.dataSource.query(
        `SELECT count(*)::int AS sin_marca FROM entregas_alerta
          WHERE actualizada_en <= creada_en`,
      );
      expect(sin_marca).toBe(0);

      // Los desinstalados, dados de baja; el resto sigue.
      expect(await aparatos.count()).toBe(N - muertos);
    }, 240_000);
  });

  /**
   * Fallos a mitad de una emisión.
   *
   * El envío de una alerta no es atómico: la pasarela es un sistema externo y lo
   * que ya salió hacia los teléfonos no se deshace con un `ROLLBACK`. Lo que sí
   * se puede garantizar son dos cosas: que ninguna alerta se pierda porque el
   * proceso murió en medio, y que un reintento no vuelva a notificar a quien ya
   * consta como notificado.
   */
  describe('fallos a mitad de una emisión', () => {
    const encolarPara = async (denunciaId: string, radioM = 2000) =>
      ctx.dataSource.transaction((manager) =>
        alertas.encolar(manager, denunciaId, radioM, 'firma'),
      );

    it('retoma una emisión que quedó «procesando» porque el proceso murió', async () => {
      // Un trabajador la tomó y murió antes de terminar —un reinicio, un
      // despliegue, falta de memoria—, así que nunca llegó a su `catch`. Si nadie
      // vuelve a tomarla, la alerta no sale y nadie se entera.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await ctx.dataSource.query(
        `UPDATE emisiones_alerta SET estado = 'procesando'`,
      );

      expect(await alertas.procesarPendientes()).toBe(1);

      const [emision] = await emisiones.find();
      expect(emision.estado).toBe('completada');
      expect(pasarela.envios).toEqual(['token-vecino@test.com']);
      // La muerte del trabajador anterior cuenta como un intento: si no, una
      // emisión que tumba el proceso cada vez se reintentaría sin fin.
      expect(emision.intentos).toBe(1);
    });

    it('un fallo al cerrar la emisión no vuelve a notificar a nadie', async () => {
      // El peor momento para fallar: todo se entregó y lo que no se pudo escribir
      // es la marca de «completada». La emisión vuelve a `pendiente` y se
      // reintenta. Si el reintento empezara de cero, cada vecino recibiría la
      // misma alerta otra vez, hasta tantas veces como intentos haya.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('uno@test.com');
      await crearVecino('dos@test.com');
      await crearVecino('tres@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);

      const cerrar = jest
        .spyOn(emisiones, 'update')
        .mockRejectedValueOnce(new Error('la base no respondió'));

      await alertas.procesarPendientes(); // entrega, y falla al cerrar
      await alertas.procesarPendientes(); // el reintento
      cerrar.mockRestore();

      expect([...pasarela.envios].sort()).toEqual([
        'token-dos@test.com',
        'token-tres@test.com',
        'token-uno@test.com',
      ]);
      expect(await entregas.count()).toBe(3);

      const [emision] = await emisiones.find();
      expect(emision.estado).toBe('completada');
      // Exactamente un intento fallido: el simulado. Sin esta comprobación, si
      // el fallo dejara de inyectarse —porque el cierre cambió de camino—, la
      // prueba pasaría sin haber probado nada.
      expect(emision.intentos).toBe(1);
    });

    it('si la pasarela cae a mitad, el reintento solo repite el lote sin confirmar', async () => {
      // Dos lotes y medio. El tercero llega a la pasarela y la respuesta se
      // pierde: esos teléfonos pudieron enterarse, pero no consta. En el
      // reintento se les vuelve a enviar —es preferible un aviso repetido a uno
      // perdido—, y a nadie más: los dos primeros lotes ya constaban.
      const autor = await crearUsuario('autor@test.com');
      const N = 2 * LOTE_DE_ENVIO + LOTE_DE_ENVIO / 2;
      await sembrarVecinos(N);
      pasarela.fallarEnLlamada = 3;

      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await alertas.procesarPendientes(); // cae en el tercer lote
      await alertas.procesarPendientes(); // reintento

      const vecesPorToken = new Map<string, number>();
      for (const t of pasarela.envios) {
        vecesPorToken.set(t, (vecesPorToken.get(t) ?? 0) + 1);
      }
      const repetidos = [...vecesPorToken.values()].filter((v) => v === 2).length;
      const unaVez = [...vecesPorToken.values()].filter((v) => v === 1).length;

      expect(vecesPorToken.size).toBe(N); // nadie se quedó sin aviso
      expect(repetidos).toBe(LOTE_DE_ENVIO / 2); // solo el lote en vuelo
      expect(unaVez).toBe(N - LOTE_DE_ENVIO / 2);

      expect(await entregas.count()).toBe(N);
      expect(await entregas.countBy({ estado: 'aceptada' })).toBe(N);
      const [emision] = await emisiones.find();
      expect(emision.estado).toBe('completada');
    });

    it('retoma una emisión cuyo arrendamiento venció', async () => {
      // El caso real tras el arreglo: el trabajador tomó la emisión, la marcó, y
      // dejó de renovar la marca porque murió.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await ctx.dataSource.query(
        `UPDATE emisiones_alerta
            SET estado = 'procesando', tomada_en = now() - interval '1 hour'`,
      );

      expect(await alertas.procesarPendientes()).toBe(1);
      expect(pasarela.envios).toEqual(['token-vecino@test.com']);
    });

    it('no toma una emisión que otro trabajador está procesando', async () => {
      // Arrendamiento vigente: hay un trabajador vivo con ella. Tomarla también
      // sería enviar la misma alerta dos veces en paralelo.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await ctx.dataSource.query(
        `UPDATE emisiones_alerta SET estado = 'procesando', tomada_en = now()`,
      );

      expect(await alertas.procesarPendientes()).toBe(0);
      expect(pasarela.envios).toEqual([]);
    });

    it('da por fallida una huérfana que ya gastó sus intentos', async () => {
      // Una emisión que tumba el proceso cada vez que se procesa no puede
      // quedarse «procesando» para siempre: tiene que constar como fallida.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await ctx.dataSource.query(
        `UPDATE emisiones_alerta
            SET estado = 'procesando', intentos = 3,
                tomada_en = now() - interval '1 hour'`,
      );

      expect(await alertas.procesarPendientes()).toBe(0);
      expect(pasarela.envios).toEqual([]);

      const [emision] = await emisiones.find();
      expect(emision.estado).toBe('fallida');
      expect(emision.ultimo_error).toContain('el proceso murió');
    });

    it('la base rechaza dos entregas de la misma emisión al mismo teléfono', async () => {
      // La garantía vive en el índice único, no solo en el código: aunque
      // alguien escriba entregas por otro camino, no puede duplicarlas.
      const autor = await crearUsuario('autor@test.com');
      await crearVecino('vecino@test.com');
      const denuncia = await crearDenunciaDifundida(autor.id);
      await encolarPara(denuncia.id);
      await alertas.procesarPendientes();

      const [entrega] = await entregas.find();
      await expect(
        entregas.insert({
          emision_id: entrega.emision_id,
          usuario_id: entrega.usuario_id,
          dispositivo_id: entrega.dispositivo_id,
          distancia_m: 0,
        }),
      ).rejects.toThrow(/uq_entregas_emision_dispositivo/);
    });
  });

  /**
   * Recibos de entrega: qué pasó con cada notificación después de que Expo la
   * aceptara.
   *
   * Es lo que separa la tasa de entrega real del techo que daba `aceptada`. Las
   * pruebas fijan el recorrido completo, las esperas que impone la pasarela y
   * que la latencia de envío —que se mide con `actualizada_en`— no se estropee
   * al llegar el recibo.
   */
  describe('recibos de entrega', () => {
    /** Emite a los vecinos dados y deja sus entregas `aceptadas`, con ticket. */
    const emitirA = async (...correos: string[]) => {
      const autor = await crearUsuario('autor@test.com');
      for (const correo of correos) await crearVecino(correo);
      const denuncia = await crearDenunciaDifundida(autor.id);
      await ctx.dataSource.transaction((manager) =>
        alertas.encolar(manager, denuncia.id, 2000, 'firma'),
      );
      await alertas.procesarPendientes();
    };

    /** Mueve hacia atrás la hora en que Expo aceptó, como si hubiera pasado el tiempo. */
    const envejecer = (minutos: number) =>
      ctx.dataSource.query(
        `UPDATE entregas_alerta
            SET actualizada_en = actualizada_en - make_interval(mins => $1)`,
        [minutos],
      );

    const laEntrega = async () => {
      const [entrega] = await entregas.find();
      return entrega;
    };

    it('el envío guarda el ticket de cada entrega aceptada', async () => {
      await emitirA('vecino@test.com');

      const entrega = await laEntrega();
      expect(entrega.estado).toBe('aceptada');
      expect(entrega.ticket_id).toBe('ticket-token-vecino@test.com');
    });

    it('un recibo positivo deja la entrega despachada sin mover la latencia de envío', async () => {
      await emitirA('vecino@test.com');
      await envejecer(20);
      const aceptadaEn = (await laEntrega()).actualizada_en;
      pasarela.recibos.set('ticket-token-vecino@test.com', {
        despachado: true,
        detalle: 'ok',
      });

      expect(await alertas.procesarRecibos()).toBe(1);

      const entrega = await laEntrega();
      expect(entrega.estado).toBe('despachada');
      expect(entrega.resultado_recibo).toBe('ok');
      expect(entrega.recibo_en).toBeInstanceOf(Date);
      // Si el recibo moviera `actualizada_en`, la latencia de envío pasaría a
      // medir los quince minutos de espera del recibo.
      expect(entrega.actualizada_en.getTime()).toBe(aceptadaEn.getTime());
    });

    it('un recibo con error la deja no despachada, con el motivo', async () => {
      await emitirA('vecino@test.com');
      await envejecer(20);
      pasarela.recibos.set('ticket-token-vecino@test.com', {
        despachado: false,
        detalle: 'MismatchSenderId: credenciales de FCM que no corresponden',
      });

      await alertas.procesarRecibos();

      const entrega = await laEntrega();
      expect(entrega.estado).toBe('no_despachada');
      expect(entrega.resultado_recibo).toContain('MismatchSenderId');
      // Un problema de credenciales no es un aparato muerto: no se da de baja.
      expect(await aparatos.count()).toBe(1);
    });

    it('si el recibo dice que el aparato ya no existe, lo da de baja y conserva la entrega', async () => {
      await emitirA('vecino@test.com');
      await envejecer(20);
      pasarela.recibos.set('ticket-token-vecino@test.com', {
        despachado: false,
        detalle: 'DeviceNotRegistered: desinstalada',
        token_invalido: true,
      });

      await alertas.procesarRecibos();

      expect(await aparatos.count()).toBe(0);
      // La auditoría de a quién se intentó avisar sobrevive a la baja.
      expect((await laEntrega()).estado).toBe('no_despachada');
    });

    it('no pregunta antes de la espera que recomienda Expo', async () => {
      await emitirA('vecino@test.com');
      pasarela.todosDespachados = true;

      expect(await alertas.procesarRecibos()).toBe(0);

      expect(pasarela.consultas).toHaveLength(0);
      expect((await laEntrega()).estado).toBe('aceptada');
    });

    it('un recibo que todavía no está listo se vuelve a pedir en el ciclo siguiente', async () => {
      await emitirA('vecino@test.com');
      await envejecer(20);

      expect(await alertas.procesarRecibos()).toBe(0);
      expect((await laEntrega()).estado).toBe('aceptada');

      pasarela.recibos.set('ticket-token-vecino@test.com', {
        despachado: true,
        detalle: 'ok',
      });
      expect(await alertas.procesarRecibos()).toBe(1);

      expect(pasarela.consultas).toHaveLength(2);
      expect((await laEntrega()).estado).toBe('despachada');
    });

    it('pasadas 24 horas sin recibo la da por perdida, sin preguntar', async () => {
      // Expo ya borró el recibo: preguntar no devuelve nada, y dejarla
      // `aceptada` la contaría como éxito para siempre.
      await emitirA('vecino@test.com');
      await envejecer(25 * 60);
      pasarela.todosDespachados = true;

      expect(await alertas.procesarRecibos()).toBe(1);

      expect(pasarela.consultas).toHaveLength(0);
      const entrega = await laEntrega();
      expect(entrega.estado).toBe('sin_recibo');
      expect(entrega.resultado_recibo).toContain('venció');
    });

    it('lo aceptado sin ticket queda sin recibo de inmediato', async () => {
      await emitirA('vecino@test.com');
      await ctx.dataSource.query(`UPDATE entregas_alerta SET ticket_id = NULL`);

      await alertas.procesarRecibos();

      const entrega = await laEntrega();
      expect(entrega.estado).toBe('sin_recibo');
      expect(entrega.resultado_recibo).toBe('la pasarela no dio ticket');
    });

    it('una entrega ya resuelta no se vuelve a consultar', async () => {
      await emitirA('vecino@test.com');
      await envejecer(20);
      pasarela.todosDespachados = true;

      await alertas.procesarRecibos();
      expect(await alertas.procesarRecibos()).toBe(0);

      expect(pasarela.consultas).toHaveLength(1);
    });

    it('recorre más de una página de recibos en el mismo ciclo', async () => {
      const cuantos = LOTE_DE_RECIBOS * 2 + 500;
      const autor = await crearUsuario('autor@test.com');
      await sembrarVecinos(cuantos);
      const denuncia = await crearDenunciaDifundida(autor.id);
      await ctx.dataSource.transaction((manager) =>
        alertas.encolar(manager, denuncia.id, 2000, 'firma'),
      );
      await alertas.procesarPendientes();
      await envejecer(20);
      pasarela.todosDespachados = true;

      expect(await alertas.procesarRecibos()).toBe(cuantos);

      expect(pasarela.consultas.map((c) => c.length)).toEqual([
        LOTE_DE_RECIBOS,
        LOTE_DE_RECIBOS,
        500,
      ]);
      expect(await entregas.count({ where: { estado: 'despachada' } })).toBe(cuantos);
    });

    it('la base rechaza un estado de entrega que el código no conoce', async () => {
      await emitirA('vecino@test.com');

      await expect(
        ctx.dataSource.query(`UPDATE entregas_alerta SET estado = 'entregada'`),
      ).rejects.toThrow(/chk_entregas_estado/);
    });
  });

  /**
   * H4.4 — Vía de acceso para la persona reportada sin cuenta previa.
   *
   * La denuncia pudo presentarse antes de que la persona registrara su documento.
   * Al hacerlo, `avisarPersonaReportada` encola el aviso directo que H4.1 no pudo
   * encolar entonces —no había a quién— y devuelve cuántas denuncias la señalan.
   */
  describe('aviso diferido a la persona reportada (H4.4)', () => {
    const crearDenunciaContra = async (
      autorId: string,
      ciHashBuscada: string,
      estado = EstadoDenuncia.ACTIVA,
      nivel = NivelConfianza.PROVISIONAL,
    ) => {
      const difundible = nivel !== NivelConfianza.REGISTRADA;
      return denuncias.save(
        denuncias.create({
          denunciante_id: autorId,
          nombre_persona_buscada: 'Luis Mamani',
          ci_hash_persona_buscada: ciHashBuscada,
          description: 'Visto por última vez el martes',
          latitude: LA_PAZ.lat,
          longitude: LA_PAZ.lng,
          nivel_confianza: nivel,
          estado,
          // La base exige la fecha en una CERRADA, y solo en ella.
          cerrada_en: estado === EstadoDenuncia.CERRADA ? new Date() : null,
          radio_actual_m: difundible ? 2000 : null,
          expira_en: difundible ? new Date(Date.now() + 86_400_000) : null,
        }),
      );
    };

    const avisosDirectosA = (usuarioId: string) =>
      emisiones.count({
        where: { usuario_objetivo_id: usuarioId, motivo: 'coincidencia_documento' },
      });

    it('encola el aviso de una denuncia activa que ya identificaba a la persona', async () => {
      const autor = await crearUsuario('autor@test.com');
      const reportada = await crearUsuario('reportada@test.com');
      await crearDenunciaContra(autor.id, reportada.ci_hash);

      const cuantas = await alertas.avisarPersonaReportada(
        reportada.id,
        reportada.ci_hash,
      );

      expect(cuantas).toBe(1);
      expect(await avisosDirectosA(reportada.id)).toBe(1);
    });

    it('avisa aunque la denuncia siga en REGISTRADA: el aviso directo no espera a la difusión', async () => {
      const autor = await crearUsuario('autor@test.com');
      const reportada = await crearUsuario('reportada@test.com');
      await crearDenunciaContra(
        autor.id,
        reportada.ci_hash,
        EstadoDenuncia.ACTIVA,
        NivelConfianza.REGISTRADA,
      );

      expect(
        await alertas.avisarPersonaReportada(reportada.id, reportada.ci_hash),
      ).toBe(1);
      expect(await avisosDirectosA(reportada.id)).toBe(1);
    });

    it('no encola nada si ninguna denuncia identifica a la persona', async () => {
      const autor = await crearUsuario('autor@test.com');
      const reportada = await crearUsuario('reportada@test.com');
      await crearDenunciaContra(autor.id, 'otro-' + 'a'.repeat(58));

      expect(
        await alertas.avisarPersonaReportada(reportada.id, reportada.ci_hash),
      ).toBe(0);
      expect(await avisosDirectosA(reportada.id)).toBe(0);
    });

    it('ignora denuncias ya invalidadas o cerradas: no hay alerta que activar', async () => {
      const autor = await crearUsuario('autor@test.com');
      const reportada = await crearUsuario('reportada@test.com');
      await crearDenunciaContra(
        autor.id,
        reportada.ci_hash,
        EstadoDenuncia.INVALIDADA,
      );
      await crearDenunciaContra(
        autor.id,
        reportada.ci_hash,
        EstadoDenuncia.CERRADA,
      );

      expect(
        await alertas.avisarPersonaReportada(reportada.id, reportada.ci_hash),
      ).toBe(0);
      expect(await avisosDirectosA(reportada.id)).toBe(0);
    });

    it('avisa de cada denuncia activa cuando hay varias', async () => {
      // De autores distintos: uno solo no puede tener dos abiertas sobre ella.
      const autor = await crearUsuario('autor@test.com');
      const otroAutor = await crearUsuario('otro-autor@test.com');
      const reportada = await crearUsuario('reportada@test.com');
      await crearDenunciaContra(autor.id, reportada.ci_hash);
      await crearDenunciaContra(otroAutor.id, reportada.ci_hash);

      expect(
        await alertas.avisarPersonaReportada(reportada.id, reportada.ci_hash),
      ).toBe(2);
      expect(await avisosDirectosA(reportada.id)).toBe(2);
    });

    it('es idempotente: repetir el registro no duplica avisos', async () => {
      const autor = await crearUsuario('autor@test.com');
      const reportada = await crearUsuario('reportada@test.com');
      await crearDenunciaContra(autor.id, reportada.ci_hash);

      await alertas.avisarPersonaReportada(reportada.id, reportada.ci_hash);
      await alertas.avisarPersonaReportada(reportada.id, reportada.ci_hash);

      expect(await avisosDirectosA(reportada.id)).toBe(1);
    });

    it('no duplica el aviso que H4.1 ya encoló al crear la denuncia', async () => {
      const autor = await crearUsuario('autor@test.com');
      const reportada = await crearUsuario('reportada@test.com');
      const denuncia = await crearDenunciaContra(autor.id, reportada.ci_hash);
      // Simula el aviso que H4.1 encola en la misma transacción de creación.
      await ctx.dataSource.transaction((manager) =>
        alertas.encolarAvisoDirecto(manager, denuncia.id, reportada.id),
      );

      const cuantas = await alertas.avisarPersonaReportada(
        reportada.id,
        reportada.ci_hash,
      );

      // Cuenta la denuncia (existe y la identifica) pero no reencola el aviso.
      expect(cuantas).toBe(1);
      expect(await avisosDirectosA(reportada.id)).toBe(1);
    });

    it('el aviso encolado se procesa y alcanza el dispositivo de la persona', async () => {
      const autor = await crearUsuario('autor@test.com');
      const reportada = await crearVecino('reportada@test.com');
      await crearDenunciaContra(autor.id, reportada.ci_hash);

      await alertas.avisarPersonaReportada(reportada.id, reportada.ci_hash);
      await alertas.procesarPendientes();

      const entregasSuyas = await entregas.count({
        where: { usuario_id: reportada.id },
      });
      expect(entregasSuyas).toBe(1);
    });
  });
});
