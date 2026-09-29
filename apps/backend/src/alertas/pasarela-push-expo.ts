import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MensajePush, PasarelaPush, Recibo, ResultadoEnvio } from './pasarela-push';

/**
 * Salida real hacia el servicio de notificaciones de Expo.
 *
 * Expo se encarga de hablar con APNs (Apple) y FCM (Google); desde aquí ambas
 * plataformas son la misma llamada. Eso es lo que hace que `plataforma` en
 * `dispositivos` sirva para medir y no para decidir a dónde enviar.
 *
 * Está escrita con `fetch` y sin el SDK de servidor a propósito. Es la **única
 * dependencia externa del sistema** —no hay forma de entregar un push sin pasar
 * por Apple o Google— y conviene que el código de esa frontera se pueda leer
 * entero: qué se manda, qué se recibe y qué se escribe en la auditoría.
 */

const ENDPOINT = 'https://exp.host/--/api/v2/push/send';
const ENDPOINT_RECIBOS = 'https://exp.host/--/api/v2/push/getReceipts';

/**
 * Mensajes por petición. Es el máximo que acepta Expo.
 *
 * Importa: una emisión de barrio puede alcanzar a cientos de personas, y mandar
 * 300 mensajes en una sola petición no devuelve un error parcial, la rechaza
 * entera.
 */
const TAMANO_LOTE = 100;

/** Tickets por consulta de recibos. Es el máximo que acepta Expo. */
const TAMANO_LOTE_RECIBOS = 1000;

/** Espera de la petición. Sin esto, una pasarela colgada bloquea el worker. */
const TIEMPO_LIMITE_MS = 30_000;

/** Lo que Expo devuelve por cada mensaje: un ticket, no un acuse de entrega. */
interface Ticket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/** Lo que Expo devuelve por cada ticket al pedir su recibo. */
interface ReciboExpo {
  status: 'ok' | 'error';
  message?: string;
  details?: { error?: string };
}

@Injectable()
export class PasarelaPushExpo extends PasarelaPush {
  private readonly logger = new Logger(PasarelaPushExpo.name);

  /**
   * Credencial opcional.
   *
   * Solo hace falta si la cuenta de Expo tiene activada la seguridad reforzada
   * para push. Sin ella el envío funciona igual, pero cualquiera que conozca un
   * token podría mandar notificaciones en nombre del proyecto.
   */
  private readonly accessToken?: string;

  constructor(config: ConfigService) {
    super();
    this.accessToken = config.get<string>('EXPO_ACCESS_TOKEN') || undefined;

    if (!this.accessToken) {
      this.logger.warn(
        'Sin EXPO_ACCESS_TOKEN: los envíos van sin autenticar. ' +
          'Activa la seguridad reforzada en la cuenta de Expo antes de publicar.',
      );
    }
  }

  async enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio[]> {
    if (mensajes.length === 0) return [];

    const resultados: ResultadoEnvio[] = [];

    // Los lotes van en serie, no con `Promise.all`. Expo limita la tasa por
    // proyecto y disparar veinte peticiones a la vez solo consigue que responda
    // 429 a la mitad. Esto es trabajo de fondo: nadie está esperando.
    for (let i = 0; i < mensajes.length; i += TAMANO_LOTE) {
      const lote = mensajes.slice(i, i + TAMANO_LOTE);
      resultados.push(...(await this.enviarLote(lote)));
    }

    const rechazados = resultados.filter((r) => !r.aceptado).length;
    this.logger.log(
      `${resultados.length - rechazados}/${resultados.length} notificación(es) aceptadas por Expo`,
    );

    return resultados;
  }

  async consultarRecibos(ticketIds: string[]): Promise<Map<string, Recibo>> {
    const recibos = new Map<string, Recibo>();

    // En serie, por lo mismo que los envíos: el límite de tasa es por proyecto.
    for (let i = 0; i < ticketIds.length; i += TAMANO_LOTE_RECIBOS) {
      const lote = ticketIds.slice(i, i + TAMANO_LOTE_RECIBOS);
      for (const [id, recibo] of await this.consultarLoteDeRecibos(lote)) {
        recibos.set(id, recibo);
      }
    }

    return recibos;
  }

  /**
   * Un fallo aquí no se reporta como recibo negativo: no se sabe nada de esas
   * notificaciones, así que simplemente no aparecen y se vuelven a pedir en el
   * siguiente ciclo. Marcarlas como no despachadas atribuiría a Apple o a Google
   * un fallo que fue de la red.
   */
  private async consultarLoteDeRecibos(ids: string[]): Promise<Array<[string, Recibo]>> {
    let respuesta: Response;
    try {
      respuesta = await fetch(ENDPOINT_RECIBOS, {
        method: 'POST',
        headers: this.cabeceras(),
        body: JSON.stringify({ ids }),
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });
    } catch (error) {
      this.logger.error(
        `Recibos no consultados (${ids.length}): no se pudo contactar la pasarela — ${(error as Error).message}`,
      );
      return [];
    }

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => '');
      this.logger.error(
        `Recibos no consultados (${ids.length}): la pasarela respondió ${respuesta.status} — ${cuerpo.slice(0, 200)}`,
      );
      return [];
    }

    let cuerpo: { data?: Record<string, ReciboExpo>; errors?: { message?: string }[] };
    try {
      cuerpo = await respuesta.json();
    } catch (error) {
      this.logger.error(`Recibos ilegibles: ${(error as Error).message}`);
      return [];
    }

    if (cuerpo.errors?.length) {
      const detalle = cuerpo.errors.map((e) => e.message ?? 'sin detalle').join('; ');
      this.logger.error(`La pasarela rechazó la consulta de recibos: ${detalle}`);
      return [];
    }

    // Solo los tickets que se pidieron: un identificador ajeno en la respuesta
    // no tiene fila a la que corresponder.
    const data = cuerpo.data ?? {};
    return ids
      .filter((id) => data[id])
      .map((id): [string, Recibo] => [id, this.aRecibo(data[id])]);
  }

  private async enviarLote(lote: MensajePush[]): Promise<ResultadoEnvio[]> {
    let respuesta: Response;

    try {
      respuesta = await fetch(ENDPOINT, {
        method: 'POST',
        headers: this.cabeceras(),
        body: JSON.stringify(lote.map((m) => this.aFormatoExpo(m))),
        signal: AbortSignal.timeout(TIEMPO_LIMITE_MS),
      });
    } catch (error) {
      // Red caída o tiempo agotado. Falla el lote entero: no hay forma de saber
      // cuáles llegaron, y marcarlos como aceptados inventaría una entrega.
      return this.fallaDelLote(lote, `no se pudo contactar la pasarela: ${(error as Error).message}`);
    }

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => '');
      return this.fallaDelLote(
        lote,
        `la pasarela respondió ${respuesta.status}: ${cuerpo.slice(0, 200)}`,
      );
    }

    let cuerpo: { data?: Ticket[]; errors?: { message?: string }[] };
    try {
      cuerpo = await respuesta.json();
    } catch (error) {
      return this.fallaDelLote(lote, `respuesta ilegible de la pasarela: ${(error as Error).message}`);
    }

    // Error de la petición completa —credencial inválida, cuerpo mal formado—:
    // viene en `errors` y entonces no hay `data`.
    if (cuerpo.errors?.length) {
      const detalle = cuerpo.errors.map((e) => e.message ?? 'sin detalle').join('; ');
      return this.fallaDelLote(lote, `la pasarela rechazó la petición: ${detalle}`);
    }

    const tickets = cuerpo.data ?? [];
    if (tickets.length !== lote.length) {
      // No se puede casar ticket con destinatario si no vienen uno a uno. Antes
      // que atribuir un resultado al token equivocado —y escribirlo en la
      // auditoría—, se da el lote por fallido.
      return this.fallaDelLote(
        lote,
        `la pasarela devolvió ${tickets.length} resultados para ${lote.length} mensajes`,
      );
    }

    // Expo responde en el mismo orden en que se mandó, así que el índice es lo
    // que devuelve el token a cada ticket; quien consume casa por token.
    return lote.map((mensaje, indice) =>
      this.aResultado(mensaje.push_token, tickets[indice]),
    );
  }

  private cabeceras(): Record<string, string> {
    return {
      'content-type': 'application/json',
      accept: 'application/json',
      ...(this.accessToken ? { authorization: `Bearer ${this.accessToken}` } : {}),
    };
  }

  private aFormatoExpo(mensaje: MensajePush) {
    return {
      to: mensaje.push_token,
      title: mensaje.titulo,
      body: mensaje.cuerpo,
      data: mensaje.datos,
      sound: 'default',
      // Sin canal, Android 8+ no muestra nada. El nombre tiene que coincidir con
      // el que crea la aplicación en `notificaciones.ts`.
      channelId: 'alertas',
      // Es una alerta de desaparición: despierta la pantalla en vez de esperar a
      // la siguiente ventana de entrega que decida el sistema operativo.
      priority: 'high',
    };
  }

  private aResultado(push_token: string, ticket: Ticket): ResultadoEnvio {
    if (ticket?.status === 'ok') {
      // Se guarda el identificador del ticket: es lo único con lo que después se
      // puede pedir el recibo y saber si Apple o Google recibieron la notificación.
      return {
        push_token,
        aceptado: true,
        ...(ticket.id ? { ticket_id: ticket.id } : {}),
        detalle: `ticket ${ticket.id ?? 'sin id'}`,
      };
    }

    const codigo = ticket?.details?.error;
    return {
      push_token,
      aceptado: false,
      detalle: `${codigo ?? 'error'}: ${ticket?.message ?? 'sin detalle'}`,
      token_invalido: codigo === 'DeviceNotRegistered',
    };
  }

  private aRecibo(recibo: ReciboExpo): Recibo {
    if (recibo.status === 'ok') {
      return { despachado: true, detalle: 'ok' };
    }

    // Los códigos posibles son los mismos que en el ticket, más los de
    // credenciales: `MismatchSenderId` e `InvalidCredentials` señalan una
    // configuración de Firebase o de Apple rota, no un aparato muerto.
    const codigo = recibo.details?.error;
    return {
      despachado: false,
      detalle: `${codigo ?? 'error'}: ${recibo.message ?? 'sin detalle'}`,
      token_invalido: codigo === 'DeviceNotRegistered',
    };
  }

  private fallaDelLote(lote: MensajePush[], detalle: string): ResultadoEnvio[] {
    this.logger.error(`Lote de ${lote.length} no enviado — ${detalle}`);

    // `token_invalido` queda sin poner a propósito: el token puede estar
    // perfectamente bien y ser la red la que falló. Dar de baja aparatos por un
    // corte dejaría a esas personas sin alertas para siempre.
    return lote.map((mensaje) => ({
      push_token: mensaje.push_token,
      aceptado: false,
      detalle,
    }));
  }
}
