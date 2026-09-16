import { Injectable, Logger } from '@nestjs/common';

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
   * mensaje y lo pondrá en cola hacia Apple o Google. Saber si el teléfono lo
   * recibió exige consultar los *recibos* con el identificador del ticket unos
   * minutos después. Mientras eso no exista, `aceptada` en `entregas_alerta`
   * quiere decir «entregada a la pasarela», y la tasa de entrega que se mida con
   * esa columna es un límite superior, no la tasa real.
   */
  aceptado: boolean;

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
      detalle: 'simulado: no se envió a la pasarela real',
    }));
  }
}
