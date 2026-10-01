import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EmisionAlerta, MotivoEmision } from './entities/emision-alerta.entity';
import { EstadoEntrega } from './entities/entrega-alerta.entity';
import { PasarelaPush, Recibo, ResultadoEnvio } from './pasarela-push';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/**
 * Cuántos teléfonos se notifican antes de dejar constancia del resultado.
 *
 * Acota el peor caso de un fallo a mitad de una emisión: si el proceso muere,
 * a lo sumo este número de personas puede recibir la alerta dos veces en el
 * reintento. Coincide con el máximo que acepta Expo por petición, así que cada
 * lote es una sola llamada a la pasarela.
 */
export const LOTE_DE_ENVIO = 100;

/** Recibos por consulta a la pasarela: el máximo que acepta Expo. */
export const LOTE_DE_RECIBOS = 1000;

/**
 * Páginas de recibos por ciclo del worker. Acota lo que tarda un ciclo —a lo
 * sumo este número de consultas a la pasarela—; lo que quede, lo toma el
 * siguiente.
 */
const PAGINAS_DE_RECIBOS_POR_CICLO = 50;

/**
 * Horas que Expo guarda un recibo. No es política sino un dato de la pasarela:
 * pasado este plazo ya no hay a quién preguntar.
 */
const VIGENCIA_RECIBO_H = 24;

/** Una entrega que espera recibo. */
interface EsperandoRecibo {
  id: string;
  ticket_id: string;
  dispositivo_id: string;
}

/** Un destinatario alcanzado por el radio, con el dispositivo donde avisarle. */
interface Destinatario {
  usuario_id: string;
  dispositivo_id: string;
  push_token: string;
  distancia_m: number;
}

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    @InjectRepository(EmisionAlerta)
    private emisionesRepository: Repository<EmisionAlerta>,
    private dataSource: DataSource,
    private pasarela: PasarelaPush,
    private configService: ConfigService,
  ) {}

  private get config(): DenunciasConfig {
    return this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);
  }

  /**
   * Encola una emisión dentro de una transacción en curso.
   *
   * Recibe el `EntityManager` de quien la llama a propósito: la fila debe
   * guardarse en la **misma transacción** que la firma que la origina. Si se
   * encolara aparte, un fallo entre una operación y otra dejaría una denuncia
   * firmada cuya alerta nunca se emite, y nadie se enteraría.
   */
  async encolar(
    manager: EntityManager,
    denunciaId: string,
    radioM: number,
    motivo: MotivoEmision,
  ): Promise<void> {
    await manager.getRepository(EmisionAlerta).insert({
      denuncia_id: denunciaId,
      radio_m: radioM,
      motivo,
      estado: 'pendiente',
    });
  }

  /**
   * Encola el aviso directo a la persona que una denuncia identifica.
   *
   * Va en la misma transacción que la creación de la denuncia, por el mismo
   * motivo que la difusión: si se encolara aparte, un fallo entre una operación
   * y otra dejaría a alguien reportado sin enterarse nunca, que es justo lo que
   * el cierre por la persona reportada existe para evitar.
   */
  async encolarAvisoDirecto(
    manager: EntityManager,
    denunciaId: string,
    usuarioObjetivoId: string,
  ): Promise<void> {
    await manager.getRepository(EmisionAlerta).insert({
      denuncia_id: denunciaId,
      usuario_objetivo_id: usuarioObjetivoId,
      radio_m: null,
      motivo: 'coincidencia_documento',
      estado: 'pendiente',
    });
  }

  /**
   * Avisa a una persona recién identificada de las denuncias activas que la
   * señalan, y devuelve cuántas son.
   *
   * Es la otra mitad de H4.1. Aquella, al crear una denuncia, busca si la persona
   * reportada ya tiene cuenta. Esta cubre el caso simétrico: alguien es denunciado
   * *antes* de registrar su documento —o sin cuenta previa— y lo registra después.
   * Sin esto, quien se registra tarde nunca recibiría el aviso que quien ya estaba
   * registrado sí recibe, y el interruptor le quedaría escondido.
   *
   * No afecta al invariante I5: esto corre cuando actúa la persona reportada, no
   * el denunciante, que ya obtuvo su respuesta idéntica al crear la denuncia.
   *
   * El número devuelto deja que el flujo de registro la encamine de inmediato al
   * interruptor —«minutos, no horas»— sin depender de que la notificación push
   * llegue: puede que aún no haya registrado ningún dispositivo.
   */
  async avisarPersonaReportada(
    usuarioId: string,
    ciHash: string,
  ): Promise<number> {
    return this.dataSource.transaction(async (manager) => {
      const emisiones = manager.getRepository(EmisionAlerta);

      const denuncias = await manager
        .getRepository(Denuncia)
        .createQueryBuilder('d')
        // `ci_hash_persona_buscada` es `select: false`; filtrar por él en el
        // WHERE no requiere seleccionarlo, y así no viaja de vuelta.
        .where('d.ci_hash_persona_buscada = :ciHash', { ciHash })
        // Solo activas: una alerta directa sobre una denuncia ya invalidada o
        // cerrada la descartaría el worker, y sobre una caducada no hay nada que
        // difundir. La persona ve igualmente las caducadas en la lista del
        // interruptor, donde puede retirarlas por si reviven.
        .andWhere('d.estado = :activa', { activa: EstadoDenuncia.ACTIVA })
        .getMany();

      for (const denuncia of denuncias) {
        // Idempotente: no repetir un aviso ya encolado. Cubre que la persona
        // rehaga el flujo de registro y que H4.1 ya la hubiera avisado al crear.
        // Sin índice único sobre la tabla de emisiones, que es también el
        // histórico de métricas y no debe rechazar reemisiones legítimas futuras.
        const yaAvisada = await emisiones.count({
          where: {
            denuncia_id: denuncia.id,
            usuario_objetivo_id: usuarioId,
            motivo: 'coincidencia_documento',
          },
        });
        if (yaAvisada > 0) continue;

        await this.encolarAvisoDirecto(manager, denuncia.id, usuarioId);
      }

      return denuncias.length;
    });
  }

  /** Dispositivos de una persona concreta, para un aviso directo. */
  private async dispositivosDe(usuarioId: string): Promise<Destinatario[]> {
    return this.dataSource
      .createQueryBuilder()
      .select('d.usuario_id', 'usuario_id')
      .addSelect('d.id', 'dispositivo_id')
      .addSelect('d.push_token', 'push_token')
      // Un aviso directo no depende de dónde esté la persona.
      .addSelect('0', 'distancia_m')
      .from('dispositivos', 'd')
      .where('d.usuario_id = :usuarioId', { usuarioId })
      .getRawMany<Destinatario>();
  }

  /**
   * Quiénes deben recibir la alerta de una denuncia.
   *
   * Tres condiciones, y ninguna es opcional:
   *
   *  - La persona está dentro de `denuncia.radio_actual_m`. El radio es del
   *    caso, no una constante del sistema: cambia al corroborarse, y la consulta
   *    no debe reescribirse cuando eso pasa.
   *  - Su última ubicación es reciente. Opera sobre la posición registrada, no
   *    sobre dónde está ahora; alertar a alguien por una zona que reportó hace
   *    una semana no informa a nadie y falsea la métrica de segmentación.
   *  - No es quien denunció: ya conoce el caso.
   */
  async destinatariosDe(denuncia: Denuncia): Promise<Destinatario[]> {
    const puntoDelCaso = `ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography`;

    return this.dataSource
      .createQueryBuilder()
      .select('u.id', 'usuario_id')
      .addSelect('d.id', 'dispositivo_id')
      .addSelect('d.push_token', 'push_token')
      .addSelect(
        `ROUND(ST_Distance(u.last_location, ${puntoDelCaso}))::int`,
        'distancia_m',
      )
      .from('users', 'u')
      .innerJoin('dispositivos', 'd', 'd.usuario_id = u.id')
      .where('u.last_location IS NOT NULL')
      .andWhere(`ST_DWithin(u.last_location, ${puntoDelCaso}, :radio)`)
      .andWhere(
        `u.last_location_at > now() - make_interval(hours => :antiguedad)`,
      )
      .andWhere('u.id != :autor', { autor: denuncia.denunciante_id })
      // Una cuenta suspendida no recibe alertas; una con falta sí, porque la
      // falta solo restringe difundir sin caso de la FELCC.
      .andWhere(`u.estado_cuenta <> 'SUSPENDIDA'`)
      .setParameters({
        lat: denuncia.latitude,
        lng: denuncia.longitude,
        radio: denuncia.radio_actual_m,
        antiguedad: this.config.antiguedadMaximaUbicacionH,
      })
      .getRawMany<Destinatario>();
  }

  /**
   * Procesa las emisiones pendientes.
   *
   * Toma los trabajos con `FOR UPDATE SKIP LOCKED`: si hubiera más de un proceso
   * trabajando, cada uno se lleva trabajos distintos en lugar de bloquearse o,
   * peor, enviar la misma alerta dos veces.
   */
  async procesarPendientes(limite = 10): Promise<number> {
    const { maxIntentosEmision, arrendamientoEmisionMin } = this.config;

    // Una emisión huérfana que ya gastó sus intentos no se retoma: se da por
    // fallida. Sin esto, una emisión que tumba el proceso cada vez que se
    // procesa quedaría «procesando» para siempre en vez de dejar constancia.
    await this.dataSource.query(
      `UPDATE emisiones_alerta
          SET estado = 'fallida',
              ultimo_error = coalesce(ultimo_error || ' · ', '') ||
                             'el proceso murió mientras la procesaba'
        WHERE estado = 'procesando'
          AND intentos >= $1
          AND (tomada_en IS NULL
               OR tomada_en < now() - make_interval(mins => $2))`,
      [maxIntentosEmision, arrendamientoEmisionMin],
    );

    const pendientes = await this.dataSource.transaction(async (manager) => {
      // Además de las pendientes, las «procesando» cuyo arrendamiento venció: su
      // trabajador murió a mitad y nadie más iba a tomarlas. Una sin marca solo
      // puede venir del código anterior al arrendamiento, y cuenta como vencida.
      const filas = await manager.query(
        `SELECT id FROM emisiones_alerta
          WHERE intentos < $1
            AND (estado = 'pendiente'
                 OR (estado = 'procesando'
                     AND (tomada_en IS NULL
                          OR tomada_en < now() - make_interval(mins => $3))))
          ORDER BY creada_en ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [maxIntentosEmision, limite, arrendamientoEmisionMin],
      );

      const ids = filas.map((f: { id: string }) => f.id);
      if (ids.length > 0) {
        // Retomar una huérfana cuenta como un intento más: el anterior murió sin
        // llegar a su `catch`, que es donde normalmente se cuentan. Las
        // expresiones del `SET` ven la fila de antes, así que el `CASE` distingue
        // la huérfana de la pendiente.
        await manager.query(
          `UPDATE emisiones_alerta
              SET intentos = intentos + CASE WHEN estado = 'procesando' THEN 1 ELSE 0 END,
                  estado = 'procesando',
                  tomada_en = now()
            WHERE id = ANY($1::uuid[])`,
          [ids],
        );
      }
      return ids as string[];
    });

    let procesadas = 0;
    for (const id of pendientes) {
      if (await this.procesarUna(id)) procesadas++;
    }
    return procesadas;
  }

  private async procesarUna(emisionId: string): Promise<boolean> {
    try {
      const emision = await this.emisionesRepository.findOneOrFail({
        where: { id: emisionId },
      });

      const denuncia = await this.dataSource
        .getRepository(Denuncia)
        .findOneOrFail({ where: { id: emision.denuncia_id } });

      // Entre encolar y procesar pudo caducar o cerrarla la persona reportada. Emitir una
      // alerta que ya no debe difundirse sería exactamente lo que el diseño
      // impide, así que se descarta el trabajo en lugar de ejecutarlo.
      // El aviso directo se envía aunque la denuncia esté REGISTRADA: la persona
      // reportada tiene derecho a enterarse antes de que nada se difunda, no
      // después. Solo se descarta si la denuncia ya dejó de estar activa.
      const esAvisoDirecto = emision.motivo === 'coincidencia_documento';
      const yaNoCorresponde = esAvisoDirecto
        ? denuncia.estado !== EstadoDenuncia.ACTIVA
        : denuncia.estado !== EstadoDenuncia.ACTIVA ||
          denuncia.nivel_confianza === NivelConfianza.REGISTRADA;

      if (yaNoCorresponde) {
        await this.emisionesRepository.update(emisionId, {
          estado: 'completada',
          destinatarios: 0,
          emitida_en: new Date(),
          ultimo_error: `descartada: la denuncia está ${denuncia.estado}/${denuncia.nivel_confianza}`,
        });
        return true;
      }

      // Un aviso directo va a una persona concreta; una difusión resuelve la
      // consulta geográfica. Es la única diferencia entre ambos recorridos.
      const destinatarios = emision.usuario_objetivo_id
        ? await this.dispositivosDe(emision.usuario_objetivo_id)
        : await this.destinatariosDe(denuncia);

      if (destinatarios.length > 0) {
        await this.enviarA(emisionId, denuncia, destinatarios, emision.motivo);
      }

      await this.emisionesRepository.update(emisionId, {
        estado: 'completada',
        destinatarios: destinatarios.length,
        emitida_en: new Date(),
      });

      this.logger.log(
        `Alerta emitida a ${destinatarios.length} destinatario(s) en ${emision.radio_m} m`,
      );
      return true;
    } catch (error) {
      const mensaje = (error as Error).message;
      this.logger.error(`Emisión ${emisionId} falló: ${mensaje}`);

      // Vuelve a pendiente para reintentar; al agotar los intentos queda fallida
      // y deja de tomarse, para no reintentar en bucle un trabajo imposible.
      await this.dataSource.query(
        `UPDATE emisiones_alerta
            SET intentos = intentos + 1,
                ultimo_error = $2,
                estado = CASE WHEN intentos + 1 >= $3 THEN 'fallida' ELSE 'pendiente' END
          WHERE id = $1`,
        [emisionId, mensaje, this.config.maxIntentosEmision],
      );
      return false;
    }
  }

  /**
   * Qué dice la notificación.
   *
   * El aviso a la persona reportada **no revela quién la denunció** (I8): solo
   * que la denuncia existe y que puede retirarla. Volcar la identidad del
   * denunciante aquí obligaría a entrar en modo confrontación a quien quizá solo
   * quiere que la alerta se detenga.
   *
   * Ninguno de los dos mensajes nombra a un tercero: la persona buscada es el
   * único sujeto identificable del sistema (I3).
   */
  private contenidoSegunMotivo(
    motivo: MotivoEmision,
    denuncia: Denuncia,
  ): { titulo: string; cuerpo: string } {
    if (motivo === 'coincidencia_documento') {
      return {
        titulo: 'Existe una denuncia que te identifica',
        cuerpo:
          'Alguien te reportó como persona desaparecida. Si estás bien, puedes retirar la alerta desde la app.',
      };
    }

    return {
      titulo: 'Persona desaparecida cerca de ti',
      cuerpo: denuncia.nombre_persona_buscada
        ? `Se busca a ${denuncia.nombre_persona_buscada}. Toca para ver los detalles.`
        : 'Hay una denuncia de desaparición en tu zona.',
    };
  }

  /** Envía y registra una entrega por destinatario, con su distancia. */
  private async enviarA(
    emisionId: string,
    denuncia: Denuncia,
    destinatarios: Destinatario[],
    motivo: MotivoEmision,
  ): Promise<void> {
    await this.registrarEncoladas(emisionId, destinatarios);

    // En un reintento, quien ya tiene resultado no se vuelve a notificar. La
    // primera vez son todos; después, solo los que quedaron sin confirmar.
    const pendientes = await this.sinResultado(emisionId, destinatarios);

    const contenido = this.contenidoSegunMotivo(motivo, denuncia);

    // Se envía y se registra **lote a lote**, no todo y después todo. Un envío
    // no se deshace con un ROLLBACK: lo que salió hacia los teléfonos, salió.
    // Si el proceso muere a mitad, lo único que puede repetirse en el reintento
    // es el lote que estaba en vuelo; los anteriores ya constan. Registrando al
    // final, en cambio, un fallo en el último paso renotificaba a la emisión
    // entera.
    for (let i = 0; i < pendientes.length; i += LOTE_DE_ENVIO) {
      const lote = pendientes.slice(i, i + LOTE_DE_ENVIO);

      const resultados = await this.pasarela.enviar(
        lote.map((d) => ({
          push_token: d.push_token,
          ...contenido,
          datos: { denuncia_id: denuncia.id, motivo },
        })),
      );

      await this.registrarResultados(emisionId, lote, resultados);
      await this.darDeBajaAparatosMuertos(resultados);
      await this.renovarArrendamiento(emisionId);
    }
  }

  /**
   * Los destinatarios de esta emisión que todavía no tienen resultado.
   *
   * «Encolada» es exactamente eso: la fila existe, pero la pasarela no llegó a
   * responder por ese teléfono —o sí respondió y no se alcanzó a escribir—.
   */
  private async sinResultado(
    emisionId: string,
    destinatarios: Destinatario[],
  ): Promise<Destinatario[]> {
    const filas: Array<{ dispositivo_id: string }> = await this.dataSource.query(
      `SELECT dispositivo_id FROM entregas_alerta
        WHERE emision_id = $1::uuid AND estado = 'encolada'`,
      [emisionId],
    );
    const encoladas = new Set(filas.map((f) => f.dispositivo_id));
    return destinatarios.filter((d) => encoladas.has(d.dispositivo_id));
  }

  /**
   * Marca que el trabajador sigue vivo y trabajando en esta emisión.
   *
   * Por sentencia directa y no por el repositorio: el cierre de la emisión sí
   * pasa por el repositorio, y las pruebas simulan su fallo ahí sin tropezar con
   * esta escritura.
   */
  private async renovarArrendamiento(emisionId: string): Promise<void> {
    await this.dataSource.query(
      `UPDATE emisiones_alerta SET tomada_en = now() WHERE id = $1::uuid`,
      [emisionId],
    );
  }

  /*
   * Las tres escrituras de abajo mandan los valores como **arreglos** y los
   * expande el servidor con `unnest`, en vez de una fila de parámetros por
   * destinatario.
   *
   * No es una optimización: es lo que permite emitir a una ciudad. PostgreSQL
   * guarda el número de parámetros de una sentencia en un entero de 16 bits, así
   * que admite 65 535 como mucho. Con cinco columnas por fila eso daba un techo
   * de ~13 100 destinatarios —un radio de ~2,5 km a densidad urbana—, y pasado
   * ese número la emisión fallaba entera y no avisaba a nadie. El error ni
   * siquiera lo decía: 20 000 filas son 100 000 parámetros, el conteo desborda a
   * 100 000 − 65 536 = 34 464, y el servidor responde «bind message has 34464
   * parameter formats but 0 parameters». Con arreglos, cada sentencia lleva un
   * número fijo de parámetros, sean diez destinatarios o doscientos mil.
   *
   * Cada escritura sigue siendo **una** sentencia, y por eso atómica.
   */

  /**
   * Una fila `encolada` por destinatario, antes de hablar con la pasarela.
   *
   * `ON CONFLICT DO NOTHING` sobre el índice único `(emision_id, dispositivo_id)`:
   * en un reintento las filas que ya existen se quedan como están, con su
   * resultado, y solo entran los destinatarios nuevos —alguien que llegó a la
   * zona entre un intento y otro—.
   */
  private async registrarEncoladas(
    emisionId: string,
    destinatarios: Destinatario[],
  ): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO entregas_alerta
              (emision_id, usuario_id, dispositivo_id, distancia_m, estado)
       SELECT $1::uuid, u.usuario_id, u.dispositivo_id, u.distancia_m, 'encolada'
         FROM unnest($2::uuid[], $3::uuid[], $4::int[])
              AS u(usuario_id, dispositivo_id, distancia_m)
       ON CONFLICT (emision_id, dispositivo_id) DO NOTHING`,
      [
        emisionId,
        destinatarios.map((d) => d.usuario_id),
        destinatarios.map((d) => d.dispositivo_id),
        destinatarios.map((d) => d.distancia_m),
      ],
    );
  }

  /**
   * Escribe lo que respondió la pasarela en la fila de cada destinatario.
   *
   * Antes era un `UPDATE` por destinatario, en serie, y para encontrar la fila de
   * cada resultado se recorría la lista entera de destinatarios: un bucle dentro
   * de otro. Con veinte mil destinatarios eran veinte mil viajes a la base y
   * unos doscientos millones de comparaciones con el proceso bloqueado. Ahora el
   * cruce se hace con un `Map` —una búsqueda constante por resultado— y la
   * escritura es una sola sentencia.
   */
  private async registrarResultados(
    emisionId: string,
    destinatarios: Destinatario[],
    resultados: ResultadoEnvio[],
  ): Promise<void> {
    // El token identifica un dispositivo y es único en `dispositivos`, así que
    // no hay dos destinatarios con el mismo y el `Map` no pierde ninguno.
    const porToken = new Map(destinatarios.map((d) => [d.push_token, d]));

    const dispositivos: string[] = [];
    const estados: EstadoEntrega[] = [];
    const detalles: string[] = [];
    const tickets: Array<string | null> = [];

    for (const resultado of resultados) {
      const destinatario = porToken.get(resultado.push_token);
      if (!destinatario) continue;

      dispositivos.push(destinatario.dispositivo_id);
      estados.push(resultado.aceptado ? 'aceptada' : 'fallida');
      detalles.push(resultado.detalle);
      tickets.push(resultado.ticket_id ?? null);
    }

    if (dispositivos.length === 0) return;

    // `actualizada_en` se pone a mano. Es `@UpdateDateColumn` y TypeORM la movía
    // solo con `repository.update()`; una sentencia escrita a mano no pasa por
    // ahí, y sin esta línea la marca quedaría en la hora de inserción y la
    // latencia de entrega mediría cero.
    //
    // La condición `= ANY($2)` repite el cruce con `u` y es redundante en
    // lógica, pero no en rendimiento. Sin ella, PostgreSQL resolvía el cruce
    // recorriendo **todas** las entregas de la emisión en cada lote —medido:
    // 20 000 filas leídas para actualizar 100—, porque todas comparten
    // `emision_id` y el índice no le servía. Con ella, busca exactamente esas
    // filas por el índice único, y el costo de cada lote deja de crecer con el
    // tamaño de la emisión.
    await this.dataSource.query(
      `UPDATE entregas_alerta AS e
          SET estado = u.estado,
              resultado_pasarela = u.detalle,
              ticket_id = u.ticket_id,
              actualizada_en = now()
         FROM unnest($2::uuid[], $3::varchar[], $4::text[], $5::varchar[])
              AS u(dispositivo_id, estado, detalle, ticket_id)
        WHERE e.emision_id = $1::uuid
          AND e.dispositivo_id = ANY($2::uuid[])
          AND e.dispositivo_id = u.dispositivo_id`,
      [emisionId, dispositivos, estados, detalles, tickets],
    );
  }

  /**
   * Borra los dispositivos cuyo token ya no corresponde a una instalación viva.
   *
   * La fila de `entregas_alerta` que acaba de escribirse **no** se toca: guarda
   * `dispositivo_id` como columna suelta, sin clave foránea hacia `dispositivos`,
   * así que el rastro de a quién se intentó alcanzar y con qué resultado
   * sobrevive al borrado. Era la condición para poder limpiar sin perder
   * auditoría.
   *
   * Sin esto, cada desinstalación deja un token que falla en toda emisión futura
   * y hunde la tasa de entrega con fallos que no dicen nada del sistema. La
   * persona vuelve a aparecer en cuanto reinstale: el registro del aparato
   * ocurre en cada arranque de la aplicación.
   */
  private async darDeBajaAparatosMuertos(
    resultados: ResultadoEnvio[],
  ): Promise<void> {
    const muertos = resultados
      .filter((r) => r.token_invalido)
      .map((r) => r.push_token);

    if (muertos.length === 0) return;

    // `= ANY` con un arreglo y no `In(...)`: `In` pone un parámetro por token y
    // arrastra el mismo techo de 65 535 que tenían las entregas. Es improbable
    // llegar ahí con aparatos muertos, pero la función no debe depender del
    // tamaño de la emisión.
    await this.dataSource.query(
      `DELETE FROM dispositivos WHERE push_token = ANY($1::varchar[])`,
      [muertos],
    );

    this.logger.log(
      `${muertos.length} dispositivo(s) dado(s) de baja: la pasarela los reporta desinstalados`,
    );
  }

  /**
   * Pide los recibos de las entregas aceptadas y deja escrito qué pasó con cada una.
   *
   * Aceptar no es entregar: el ticket solo dice que Expo tomó el mensaje. El
   * recibo, que Expo tiene listo unos minutos después y guarda 24 horas, dice si
   * Apple o Google lo recibieron. Sin este paso, la tasa de entrega que se mida
   * es un techo: cuenta como éxito todo lo que Expo tomó, llegara o no.
   *
   * No hace falta bloquear filas: cada escritura exige que la entrega siga
   * `aceptada`, así que si dos procesos piden el mismo recibo, el segundo no
   * cambia nada. Devuelve cuántas entregas quedaron resueltas.
   */
  async procesarRecibos(): Promise<number> {
    // Primero lo que ya no va a tener recibo, para no preguntar en vano.
    let resueltas = await this.cerrarSinRecibo();

    // Por páginas, recorriendo por `id`. Un recibo que todavía no está listo
    // deja su fila `aceptada`, y sin avanzar el cursor la misma página volvería
    // una y otra vez.
    let desde: string | null = null;
    for (let pagina = 0; pagina < PAGINAS_DE_RECIBOS_POR_CICLO; pagina++) {
      const filas: EsperandoRecibo[] = await this.dataSource.query(
        `SELECT id, ticket_id, dispositivo_id
           FROM entregas_alerta
          WHERE estado = 'aceptada'
            AND ticket_id IS NOT NULL
            AND actualizada_en <= now() - make_interval(mins => $1)
            AND ($2::uuid IS NULL OR id > $2::uuid)
          ORDER BY id
          LIMIT $3`,
        [this.config.esperaReciboMin, desde, LOTE_DE_RECIBOS],
      );
      if (filas.length === 0) break;

      const recibos = await this.pasarela.consultarRecibos(
        filas.map((f) => f.ticket_id),
      );
      resueltas += await this.registrarRecibos(filas, recibos);

      desde = filas[filas.length - 1].id;
      if (filas.length < LOTE_DE_RECIBOS) break;
    }

    return resueltas;
  }

  /**
   * Da por perdido el recibo de lo que ya no lo va a tener.
   *
   * Expo borra los recibos a las 24 horas: pasado ese plazo, preguntar no
   * devuelve nada, y la entrega quedaría `aceptada` para siempre, contando como
   * éxito sin serlo. Tampoco tendrá recibo lo aceptado sin ticket. Las dos van a
   * `sin_recibo`: resultado desconocido, que se cuenta aparte.
   *
   * El plazo se mide desde que Expo aceptó, que es `actualizada_en`: esa marca no
   * se mueve después, justamente para no perder la latencia de envío.
   */
  private async cerrarSinRecibo(): Promise<number> {
    const [, cerradas]: [unknown[], number] = await this.dataSource.query(
      `UPDATE entregas_alerta
          SET estado = 'sin_recibo',
              resultado_recibo = CASE
                WHEN ticket_id IS NULL THEN 'la pasarela no dio ticket'
                ELSE 'el recibo venció sin haberse podido consultar'
              END,
              recibo_en = now()
        WHERE estado = 'aceptada'
          AND (ticket_id IS NULL
               OR actualizada_en < now() - make_interval(hours => $1))`,
      [VIGENCIA_RECIBO_H],
    );
    return cerradas;
  }

  /**
   * Escribe cada recibo en su entrega y da de baja los aparatos que ya no existen.
   *
   * Un ticket sin recibo en la respuesta todavía no está listo, o la consulta
   * falló: su entrega sigue `aceptada` y se vuelve a pedir en el siguiente ciclo.
   */
  private async registrarRecibos(
    filas: EsperandoRecibo[],
    recibos: Map<string, Recibo>,
  ): Promise<number> {
    const ids: string[] = [];
    const estados: EstadoEntrega[] = [];
    const detalles: string[] = [];
    const muertos: string[] = [];

    for (const fila of filas) {
      const recibo = recibos.get(fila.ticket_id);
      if (!recibo) continue;

      ids.push(fila.id);
      estados.push(recibo.despachado ? 'despachada' : 'no_despachada');
      detalles.push(recibo.detalle);
      if (recibo.token_invalido) muertos.push(fila.dispositivo_id);
    }

    if (ids.length === 0) return 0;

    // `actualizada_en` no se toca: mide cuándo aceptó Expo, y de ahí sale la
    // latencia de envío. El momento del recibo va en `recibo_en`.
    const [, escritas]: [unknown[], number] = await this.dataSource.query(
      `UPDATE entregas_alerta AS e
          SET estado = u.estado,
              resultado_recibo = u.detalle,
              recibo_en = now()
         FROM unnest($1::uuid[], $2::varchar[], $3::text[]) AS u(id, estado, detalle)
        WHERE e.id = u.id
          AND e.estado = 'aceptada'`,
      [ids, estados, detalles],
    );

    if (muertos.length > 0) {
      // Por identificador y no por token, porque el recibo no trae el token. Es
      // seguro: el token de una fila de `dispositivos` no cambia —un token nuevo
      // es otra fila—, así que esta es exactamente la instalación que murió. La
      // entrega se queda: no tiene clave foránea hacia el aparato.
      await this.dataSource.query(
        `DELETE FROM dispositivos WHERE id = ANY($1::uuid[])`,
        [muertos],
      );
      this.logger.log(
        `${muertos.length} dispositivo(s) dado(s) de baja: el recibo los reporta desinstalados`,
      );
    }

    return escritas;
  }
}
