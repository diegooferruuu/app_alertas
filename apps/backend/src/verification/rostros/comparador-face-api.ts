import { Injectable, Logger } from '@nestjs/common';
import * as path from 'path';
import { ComparadorDeRostros } from './comparador-de-rostros';
import { ResultadoComparacion } from '../domain/comparacion-facial';

/**
 * Comparación de rostros con face-api sobre TensorFlow.js.
 *
 * Corre en el servidor y no en el teléfono a propósito. Toda la garantía del
 * sistema es la atribución: una aplicación modificada podría afirmar que dos
 * rostros coinciden sin haberlos mirado, y entonces la comprobación no valdría
 * nada. Aquí el cliente solo aporta las dos imágenes; quien decide es el
 * servidor.
 *
 * Usa la compilación WASM de face-api con `sharp` para decodificar, en vez del
 * camino habitual (`@tensorflow/tfjs-node` más `@canvas/image`), que exige
 * binarios nativos. Los modelos vienen dentro del propio paquete npm: no se
 * descarga nada en tiempo de ejecución y el servidor funciona sin salida a
 * internet.
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

@Injectable()
export class ComparadorFaceApi extends ComparadorDeRostros {
  private readonly logger = new Logger(ComparadorFaceApi.name);

  /** Carga de modelos en curso o ya terminada. Se hace una sola vez. */
  private preparacion: Promise<TiempoDeEjecucion> | null = null;

  /**
   * Cola de una sola posición.
   *
   * TensorFlow.js mantiene estado global por backend; dos inferencias
   * simultáneas en el mismo proceso pueden pisarse. Registrar un documento es
   * una operación rara —una vez por cuenta— así que serializar no cuesta nada y
   * evita una clase de fallo difícil de reproducir.
   */
  private turno: Promise<void> = Promise.resolve();

  async comparar(
    documento: Buffer,
    selfie: Buffer,
  ): Promise<ResultadoComparacion> {
    return this.enTurno(async (): Promise<ResultadoComparacion> => {
      const runtime = await this.preparar();

      const rostroDocumento = await this.descriptorDe(runtime, documento);
      if (!rostroDocumento) {
        return { estado: 'sin_rostro_en_documento' };
      }

      const rostroSelfie = await this.descriptorDe(runtime, selfie);
      if (!rostroSelfie) {
        return { estado: 'sin_rostro_en_selfie' };
      }

      // `faceapi` no trae tipos en esta compilación, así que la distancia entra
      // como `any`: se fija a número aquí para que el resto del sistema no herede
      // la imprecisión.
      const distancia: number = Number(
        runtime.faceapi.euclideanDistance(rostroDocumento, rostroSelfie),
      );

      // Se registra la distancia, nunca los descriptores: un descriptor
      // identifica a una persona igual que su fotografía.
      this.logger.debug(`Distancia entre rostros: ${distancia.toFixed(4)}`);

      // Se devuelve la medición y nada más. Quién decide qué significa esa
      // distancia es el núcleo; ver `ResultadoComparacion`.
      return { estado: 'comparado', distancia };
    });
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
   * Carga el backend y los tres modelos, una sola vez por proceso.
   *
   * La importación es dinámica para que arrancar el servidor no pague el costo
   * de cargar TensorFlow: la mayoría de las peticiones no comparan rostros.
   */
  private async preparar(): Promise<TiempoDeEjecucion> {
    if (!this.preparacion) {
      this.preparacion = this.cargar().catch((error) => {
        // Si falla, se olvida: el siguiente intento vuelve a probar en vez de
        // quedar con una promesa rechazada cacheada para siempre.
        this.preparacion = null;
        throw error;
      });
    }
    return this.preparacion;
  }

  private async cargar(): Promise<TiempoDeEjecucion> {
    const comienzo = Date.now();

    const tf = await import('@tensorflow/tfjs');
    const wasm = await import('@tensorflow/tfjs-backend-wasm');
    // La compilación `node-wasm` es la única que no exige binarios nativos.
    const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');
    const sharp = (await import('sharp')).default;

    // Los binarios WASM salen de node_modules, no de una CDN: el servidor tiene
    // que poder arrancar sin internet.
    wasm.setWasmPaths(
      path.join(
        path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')),
        'dist/',
      ),
    );
    await tf.setBackend('wasm');
    await tf.ready();

    const raizModelos = path.join(
      path.dirname(require.resolve('@vladmandic/face-api/package.json')),
      'model',
    );
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(raizModelos);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(raizModelos);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(raizModelos);

    this.logger.log(
      `Modelos de comparación facial cargados en ${Date.now() - comienzo}ms (backend ${tf.getBackend()})`,
    );

    return {
      tf,
      faceapi,
      sharp,
      // `maxResults: 1` se queda con el rostro más prominente. En la foto de un
      // carnet es el retrato impreso; en una selfie, quien se la tomó.
      opciones: new faceapi.SsdMobilenetv1Options({
        minConfidence: 0.5,
        maxResults: 1,
      }),
    };
  }

  /**
   * Descriptor de 128 dimensiones del rostro más prominente, o `null` si no hay
   * ninguno.
   *
   * El tensor se libera siempre: cada imagen ocupa ancho × alto × 3 bytes fuera
   * del recolector de basura de JavaScript, y olvidarse de uno por registro
   * termina agotando la memoria del proceso.
   */
  private async descriptorDe(
    { tf, faceapi, sharp, opciones }: TiempoDeEjecucion,
    imagen: Buffer,
  ): Promise<Float32Array | null> {
    const { data, info } = await sharp(imagen)
      // Se acota el lado mayor antes de nada. Un teléfono actual manda fotos de
      // 4000 px de ancho, y el tensor en crudo ocupa ancho × alto × 3 bytes: esa
      // imagen sola son 36 MB fuera del recolector de basura, por cada una de
      // las dos y por cada registro simultáneo. El detector trabaja a 512 px
      // internamente, así que por encima de este tope no se gana nada.
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const tensor = tf.tensor3d(
      new Uint8Array(data),
      [info.height, info.width, 3],
      'int32',
    );

    try {
      const caras = await faceapi
        .detectAllFaces(tensor, opciones)
        .withFaceLandmarks()
        .withFaceDescriptors();
      return caras.length > 0 ? caras[0].descriptor : null;
    } finally {
      tf.dispose(tensor);
    }
  }
}

interface TiempoDeEjecucion {
  tf: typeof import('@tensorflow/tfjs');
  faceapi: any;
  sharp: typeof import('sharp');
  opciones: any;
}
