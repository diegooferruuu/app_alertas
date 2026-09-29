import { BadRequestException, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { LectorDeDocumento } from './lector-de-documento';

/**
 * Lectura de documentos con Tesseract.
 *
 * Corre en un hilo aparte sin que haya que pedirlo: `tesseract.js` levanta su
 * propio *worker thread*. Se midió —150 ms de reloj y 5,7 ms de bloqueo del
 * bucle de eventos, por debajo del ruido de fondo— así que, a diferencia de la
 * inferencia facial, no le quita el turno a las demás peticiones.
 *
 * El idioma es español porque es lo que dice un carnet boliviano. Cambiarlo no
 * es gratis: el modelo de idioma se descarga la primera vez y se guarda en
 * caché.
 */
@Injectable()
export class LectorTesseract extends LectorDeDocumento implements OnModuleDestroy {
  private readonly logger = new Logger(LectorTesseract.name);

  /**
   * Trabajador reutilizado entre lecturas.
   *
   * Antes se creaba y se destruía uno por documento, y arrancarlo cuesta unos
   * 160 ms que se pagaban en cada registro. Mantenerlo vivo los paga una sola
   * vez por proceso. Se crea de forma perezosa: arrancar el servidor no debe
   * cargar un modelo de idioma que la mayoría de las peticiones no usa.
   */
  private trabajador: Promise<any> | null = null;

  /**
   * Cola de una sola posición.
   *
   * Un trabajador de Tesseract atiende un reconocimiento a la vez; dos llamadas
   * concurrentes sobre el mismo se pisan. Registrar un documento ocurre una vez
   * por cuenta, así que serializar no cuesta nada.
   */
  private turno: Promise<void> = Promise.resolve();

  async leer(imagen: Buffer): Promise<string> {
    return this.enTurno(async () => {
      try {
        const trabajador = await this.obtenerTrabajador();
        const { data } = await trabajador.recognize(imagen);
        this.logger.debug(`OCR extrajo ${data.text.length} caracteres`);
        return data.text as string;
      } catch (error) {
        // Se traduce a un error del cliente: una imagen ilegible es un problema
        // de la foto que se mandó, no un fallo del servidor, y la persona puede
        // arreglarlo repitiéndola.
        throw new BadRequestException(
          `No se pudo leer el documento: ${(error as Error).message}`,
        );
      }
    });
  }

  private async obtenerTrabajador(): Promise<any> {
    if (!this.trabajador) {
      this.trabajador = this.crearTrabajador().catch((error) => {
        // Si falla, se olvida: el siguiente intento vuelve a probar en vez de
        // quedar con una promesa rechazada cacheada para siempre.
        this.trabajador = null;
        throw error;
      });
    }
    return this.trabajador;
  }

  private async crearTrabajador(): Promise<any> {
    const comienzo = Date.now();
    const { createWorker } = await import('tesseract.js');

    // `errorHandler` no es opcional por comodidad: sin él, `tesseract.js`
    // rechaza la promesa del trabajo **y además** hace `throw` dentro del
    // manejador de mensajes del hilo (`createWorker.js`, rama `status ===
    // 'reject'`). Ese `throw` no ocurre dentro de ninguna cadena de promesas,
    // así que ningún `try/catch` de aquí lo alcanza: sube como excepción no
    // capturada y tumba el proceso. Una imagen ilegible —una foto movida, un
    // archivo truncado— pasaría de ser un 400 a ser una caída del servidor
    // provocable por cualquiera que suba un documento.
    //
    // Dárselo solo sustituye ese `throw`. El rechazo de la promesa ya se emitió
    // una línea antes, y el fallo de carga del modelo también, así que no se
    // pierde ningún error: el de `leer` se sigue atrapando y traduciendo abajo.
    const trabajador = await createWorker('spa', undefined, {
      errorHandler: (detalle: unknown) => {
        this.logger.warn(`Tesseract rechazó el trabajo: ${String(detalle)}`);
      },
    });

    this.logger.log(`Trabajador de OCR listo en ${Date.now() - comienzo}ms`);
    return trabajador;
  }

  /**
   * El trabajador sostiene un hilo; sin cerrarlo, el proceso no termina de
   * apagarse y las pruebas que crean un módulo por archivo lo dejarían colgado.
   */
  async onModuleDestroy(): Promise<void> {
    if (!this.trabajador) return;
    try {
      const trabajador = await this.trabajador;
      await trabajador.terminate();
    } catch {
      // Apagar es lo último que ocurre: un fallo aquí no tiene a quién importarle.
    } finally {
      this.trabajador = null;
    }
  }

  private enTurno<T>(tarea: () => Promise<T>): Promise<T> {
    const anterior = this.turno;
    let liberar!: () => void;
    this.turno = new Promise<void>((resolver) => {
      liberar = resolver;
    });
    return anterior.then(tarea, tarea).finally(liberar);
  }
}
