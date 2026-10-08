import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as path from 'path';
import { Worker } from 'worker_threads';
import { ComparadorDeRostros } from './comparador-de-rostros';
import { ResultadoComparacion } from '../domain/comparacion-facial';
import type {
  PeticionComparacion,
  Pixeles,
  RespuestaComparacion,
} from './protocolo-del-hilo';

/**
 * Comparación de rostros con face-api sobre TensorFlow.js.
 *
 * Corre en el servidor y no en el teléfono a propósito. Toda la garantía del
 * sistema es la atribución: una aplicación modificada podría afirmar que dos
 * rostros coinciden sin haberlos mirado, y entonces la comprobación no valdría
 * nada. Aquí el cliente solo aporta las dos imágenes; quien decide es el
 * servidor.
 *
 * **La inferencia corre en un hilo aparte** (`hilo-de-inferencia.ts`). En el
 * hilo principal congelaba el servidor unos 200 ms por imagen —medido con
 * `tools/medir-bloqueo.cjs`—, y en ese tiempo no salía ninguna alerta ni
 * respondía ninguna otra petición. Aquí solo se decodifican las imágenes, que
 * no bloquea porque `sharp` trabaja en el pool de hilos de libuv, y se espera la
 * respuesta.
 *
 * **No decide nada.** Mide la distancia entre dos rostros y la devuelve; el
 * umbral que la convierte en un sí o un no vive en el dominio.
 */

/**
 * Lado mayor al que se reduce cada imagen antes de la inferencia.
 *
 * Suficientemente alto para que el retrato impreso de un carnet fotografiado de
 * cerca siga midiendo más de cien píxeles —que es donde el modelo aún reconoce—
 * y suficientemente bajo para que la memoria no dependa de qué teléfono tenga
 * quien se registra.
 */
const LADO_MAXIMO = 1280;

/**
 * Espera máxima de una comparación, carga de modelos incluida (medida: menos de
 * un segundo). Pasado esto el hilo se da por colgado: se termina y la siguiente
 * comparación arranca uno nuevo.
 */
const TIEMPO_LIMITE_MS = 60_000;

/**
 * El hilo es su propio archivo, junto a este. Compilado es `.js`; en las
 * pruebas, que corren el TypeScript directamente, es `.ts`, y el hilo necesita
 * ts-node para leerlo.
 */
const EXTENSION = path.extname(__filename);
const ARCHIVO_DEL_HILO = path.join(__dirname, `hilo-de-inferencia${EXTENSION}`);
const ARGUMENTOS_DEL_HILO =
  EXTENSION === '.ts' ? ['--require', 'ts-node/register/transpile-only'] : [];

interface Pendiente {
  resolver: (respuesta: RespuestaComparacion) => void;
  rechazar: (error: Error) => void;
  temporizador: NodeJS.Timeout;
}

@Injectable()
export class ComparadorFaceApi extends ComparadorDeRostros implements OnModuleDestroy {
  private readonly logger = new Logger(ComparadorFaceApi.name);

  /**
   * Se arranca con la primera comparación, no al levantar el servidor: la
   * mayoría de las peticiones no comparan rostros, y cargar TensorFlow cuesta
   * memoria. Una vez arriba se queda, con los modelos cargados.
   */
  private hilo: Worker | null = null;
  private readonly pendientes = new Map<number, Pendiente>();
  private siguienteId = 1;

  /**
   * Cola de una sola posición.
   *
   * TensorFlow.js mantiene estado global por backend; dos inferencias
   * intercaladas en el mismo hilo pueden pisarse. Registrar un documento es una
   * operación rara —una vez por cuenta— así que serializar no cuesta nada y
   * evita una clase de fallo difícil de reproducir.
   */
  private turno: Promise<void> = Promise.resolve();

  async comparar(
    documento: Buffer,
    selfie: Buffer,
  ): Promise<ResultadoComparacion> {
    return this.enTurno(async (): Promise<ResultadoComparacion> => {
      const [pixelesDocumento, pixelesSelfie] = await Promise.all([
        this.pixelesDe(documento),
        this.pixelesDe(selfie),
      ]);

      const respuesta = await this.enviarAlHilo(pixelesDocumento, pixelesSelfie);
      if ('error' in respuesta) {
        throw new Error(`La comparación facial falló: ${respuesta.error}`);
      }

      if (respuesta.cargaMs !== undefined) {
        this.logger.log(
          `Modelos de comparación facial cargados en ${respuesta.cargaMs}ms, en su propio hilo`,
        );
      }
      if (respuesta.resultado.estado === 'comparado') {
        // Se registra la distancia, nunca los descriptores: esos ni siquiera
        // salen del hilo.
        this.logger.debug(
          `Distancia entre rostros: ${respuesta.resultado.distancia.toFixed(4)}`,
        );
      }

      // Se devuelve la medición y nada más. Quién decide qué significa esa
      // distancia es el núcleo; ver `ResultadoComparacion`.
      return respuesta.resultado;
    });
  }

  /** Al apagar el servidor: que el hilo no quede vivo ni con trabajo a medias. */
  async onModuleDestroy(): Promise<void> {
    this.descartarHilo(new Error('el servidor se está apagando'));
  }

  private enTurno<T>(tarea: () => Promise<T>): Promise<T> {
    const anterior = this.turno;

    // El turno siguiente se libera pase lo que pase con este: si una
    // comparación revienta, la próxima tiene que correr igual en vez de quedar
    // encolada detrás de una promesa rechazada para siempre.
    let liberar!: () => void;
    this.turno = new Promise<void>((resolver) => {
      liberar = resolver;
    });

    return anterior.then(tarea, tarea).finally(liberar);
  }

  /**
   * RGB crudo, con el lado mayor acotado.
   *
   * Se acota antes de nada: un teléfono actual manda fotos de 4000 px, y en
   * crudo esa imagen sola son 36 MB. El detector trabaja a 512 px, así que por
   * encima del tope no se gana nada.
   */
  private async pixelesDe(imagen: Buffer): Promise<Pixeles> {
    const sharp = (await import('sharp')).default;
    const { data, info } = await sharp(imagen)
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Copia a memoria propia: esa es la que se *transfiere* al hilo, sin otra
    // copia. La de `sharp` puede ser memoria externa, que no se puede transferir.
    const datos = new Uint8Array(data.length);
    datos.set(data);
    return { datos: datos.buffer, ancho: info.width, alto: info.height };
  }

  private enviarAlHilo(documento: Pixeles, selfie: Pixeles): Promise<RespuestaComparacion> {
    const hilo = this.hiloListo();
    const id = this.siguienteId++;

    return new Promise<RespuestaComparacion>((resolver, rechazar) => {
      const temporizador = setTimeout(() => {
        // Un hilo que no responde puede estar colgado a mitad de una
        // inferencia. No se le puede interrumpir: se termina y el siguiente
        // registro arranca uno nuevo.
        this.descartarHilo(
          new Error(`el hilo de inferencia no respondió en ${TIEMPO_LIMITE_MS / 1000} s`),
        );
      }, TIEMPO_LIMITE_MS);

      this.pendientes.set(id, { resolver, rechazar, temporizador });

      const peticion: PeticionComparacion = { id, documento, selfie };
      try {
        hilo.postMessage(peticion, [documento.datos, selfie.datos]);
      } catch (error) {
        // Si ni siquiera salió, el hilo sigue sano: se retira solo esta petición,
        // sin dejar vivo un temporizador que después lo terminaría.
        clearTimeout(temporizador);
        this.pendientes.delete(id);
        rechazar(error as Error);
      }
    });
  }

  private hiloListo(): Worker {
    if (this.hilo) return this.hilo;

    const hilo = new Worker(ARCHIVO_DEL_HILO, { execArgv: ARGUMENTOS_DEL_HILO });
    // Ocioso, el hilo no debe mantener vivo el proceso. Mientras hay una
    // comparación en curso, lo mantiene su temporizador.
    hilo.unref();

    hilo.on('message', (respuesta: RespuestaComparacion) => {
      const pendiente = this.pendientes.get(respuesta.id);
      if (!pendiente) return;
      this.pendientes.delete(respuesta.id);
      clearTimeout(pendiente.temporizador);
      pendiente.resolver(respuesta);
    });

    // Si el hilo muere —falta de memoria, un fallo dentro de WASM—, quien
    // esperaba recibe un error en vez de quedarse esperando, y el siguiente
    // registro arranca un hilo nuevo.
    hilo.on('error', (error) => {
      this.logger.error(`El hilo de inferencia falló: ${error.message}`);
      this.descartarHilo(error);
    });
    hilo.on('exit', (codigo) => {
      if (this.hilo === hilo) {
        this.descartarHilo(new Error(`el hilo de inferencia terminó (código ${codigo})`));
      }
    });

    this.hilo = hilo;
    return hilo;
  }

  private descartarHilo(motivo: Error): void {
    const hilo = this.hilo;
    this.hilo = null;

    for (const [id, pendiente] of this.pendientes) {
      clearTimeout(pendiente.temporizador);
      pendiente.rechazar(motivo);
      this.pendientes.delete(id);
    }

    if (hilo) void hilo.terminate();
  }
}
