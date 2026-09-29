import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

export interface MensajePush {
  push_token: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, string>;
}

export interface ResultadoEnvio {
  push_token: string;

  /**
   * La pasarela **aceptó** el mensaje. No significa que llegara.
   *
   * Expo responde con un *ticket*, no con un acuse de entrega: dice que tomó el
   * mensaje y lo pondrá en cola hacia Apple o Google. Qué pasó después lo dice
   * el *recibo* de ese ticket, que se pide unos minutos más tarde (ver
   * `consultarRecibos`).
   */
  aceptado: boolean;

  /** Identificador del ticket, si se aceptó: con él se pide el recibo. */
  ticket_id?: string;

  detalle: string;

  /**
   * El token ya no corresponde a una instalación viva.
   *
   * Ocurre cuando alguien desinstala la aplicación o reinstala y recibe otro
   * token. No es un fallo transitorio: reintentarlo no lo va a arreglar nunca,
   * y dejarlo en la tabla iría ensuciando la tasa de entrega con fallos que no
   * dicen nada del sistema. Quien lo recibe da de baja el aparato.
   */
  token_invalido?: boolean;
}

/**
 * Lo que dice el recibo de un mensaje aceptado.
 *
 * Expo lo tiene listo unos minutos después del envío y lo guarda 24 horas.
 */
export interface Recibo {
  /**
   * Apple o Google recibieron la notificación.
   *
   * Es lo más lejos que llega lo que se puede saber. El último tramo —de Apple o
   * Google al teléfono— no lo informa nadie: un teléfono apagado la recibe al
   * encenderse, o nunca. Por eso esto es «despachada» y no «entregada».
   */
  despachado: boolean;

  detalle: string;

  /** Igual que en el envío: el aparato ya no existe y hay que darlo de baja. */
  token_invalido?: boolean;
}

/**
 * Salida hacia el servicio de notificaciones.
 *
 * Es una interfaz y no una llamada directa a Expo por dos razones. La primera
 * es probar: el worker se puede ejercitar entero sin depender de una red ni de
 * un teléfono real. La segunda es que la pasarela es la **única dependencia
 * externa** del sistema —no se puede entregar un push sin pasar por Apple o
 * Google—, y conviene que esa frontera esté explícita en el código.
 */
export abstract class PasarelaPush {
  abstract enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio[]>;

  /**
   * Recibos de los tickets dados, por identificador de ticket.
   *
   * Un ticket cuyo recibo todavía no está listo —o que ya venció— no aparece en
   * el resultado, y tampoco los de una consulta que falló: quien llama los
   * vuelve a pedir en el siguiente ciclo. Por eso no lanza por un fallo de red.
   */
  abstract consultarRecibos(ticketIds: string[]): Promise<Map<string, Recibo>>;
}

/**
 * Implementación de desarrollo: registra el envío sin salir a la red.
 *
 * Permite construir y medir el flujo completo antes de tener configurado el
 * servicio de notificaciones. **No es un doble de prueba**: corre en desarrollo
 * y deja rastro en el registro, para poder seguir el recorrido de una alerta.
 *
 * Sustituirla por la implementación real de Expo es cambiar la clase enlazada
 * en el módulo; nada más del sistema cambia.
 */
@Injectable()
export class PasarelaPushSimulada extends PasarelaPush {
  private readonly logger = new Logger(PasarelaPushSimulada.name);

  async enviar(mensajes: MensajePush[]): Promise<ResultadoEnvio[]> {
    this.logger.log(
      `[simulado] ${mensajes.length} notificación(es) que se habrían enviado`,
    );

    return mensajes.map((mensaje) => ({
      push_token: mensaje.push_token,
      aceptado: true,
      // Un ticket inventado, para que el recorrido completo —envío y recibo— se
      // pueda seguir también en desarrollo.
      ticket_id: `simulado-${randomUUID()}`,
      detalle: 'simulado: no se envió a la pasarela real',
    }));
  }

  async consultarRecibos(ticketIds: string[]): Promise<Map<string, Recibo>> {
    if (ticketIds.length > 0) {
      this.logger.log(`[simulado] ${ticketIds.length} recibo(s) positivos inventados`);
    }
    return new Map(
      ticketIds.map((id) => [
        id,
        { despachado: true, detalle: 'simulado: no hubo pasarela real' },
      ]),
    );
  }
}
