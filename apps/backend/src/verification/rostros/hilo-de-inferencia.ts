/**
 * Hilo de inferencia facial: aquí corre el modelo, fuera del hilo principal.
 *
 * Node atiende todas las peticiones en un solo hilo. Con la inferencia ahí, cada
 * comparación lo congelaba unos 200 ms por imagen —medido—, y en ese tiempo no
 * salía ninguna alerta ni respondía ninguna otra petición. Aquí el modelo tiene
 * su propio hilo y el principal solo espera la respuesta.
 *
 * No se ejecuta directamente: lo arranca `ComparadorFaceApi`. Atiende una
 * petición a la vez, porque el comparador las serializa antes de mandarlas.
 */
import { parentPort } from 'worker_threads';
import * as path from 'path';
import type { ResultadoComparacion } from '../domain/comparacion-facial';
import type {
  PeticionComparacion,
  Pixeles,
  RespuestaComparacion,
} from './protocolo-del-hilo';

interface Modelos {
  tf: typeof import('@tensorflow/tfjs');
  // `faceapi` no trae tipos en su compilación WASM.
  faceapi: any;
  opciones: any;
}

/** Carga en curso o terminada. Una sola vez por hilo. */
let preparacion: Promise<Modelos> | null = null;

const preparar = (): Promise<Modelos> => {
  if (!preparacion) {
    preparacion = cargar().catch((error) => {
      // Si falla, se olvida: la siguiente petición vuelve a intentarlo en vez de
      // quedar con una promesa rechazada para siempre.
      preparacion = null;
      throw error;
    });
  }
  return preparacion;
};

/**
 * Backend WASM y los tres modelos, que vienen dentro del paquete npm: no se
 * descarga nada y el servidor funciona sin internet. Es la compilación que no
 * exige binarios nativos, y por eso también la que corre sin problemas en un
 * hilo aparte.
 */
async function cargar(): Promise<Modelos> {
  const tf = await import('@tensorflow/tfjs');
  const wasm = await import('@tensorflow/tfjs-backend-wasm');
  const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

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

  return {
    tf,
    faceapi,
    // `maxResults: 1` se queda con el rostro más prominente. En la foto de un
    // carnet es el retrato impreso; en una selfie, quien se la tomó.
    opciones: new faceapi.SsdMobilenetv1Options({ minConfidence: 0.5, maxResults: 1 }),
  };
}

/**
 * Descriptor de 128 dimensiones del rostro más prominente, o `null` si no hay
 * ninguno.
 *
 * El tensor se libera siempre: ocupa ancho × alto × 3 bytes fuera del
 * recolector de basura, y olvidarse de uno por registro termina agotando la
 * memoria del hilo.
 */
async function descriptorDe(
  { tf, faceapi, opciones }: Modelos,
  imagen: Pixeles,
): Promise<Float32Array | null> {
  const tensor = tf.tensor3d(
    new Uint8Array(imagen.datos),
    [imagen.alto, imagen.ancho, 3],
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

async function comparar(peticion: PeticionComparacion): Promise<RespuestaComparacion> {
  const cargados = preparacion !== null;
  const comienzo = Date.now();
  const modelos = await preparar();
  const cargaMs = cargados ? undefined : Date.now() - comienzo;

  const responder = (resultado: ResultadoComparacion): RespuestaComparacion => ({
    id: peticion.id,
    resultado,
    ...(cargaMs !== undefined ? { cargaMs } : {}),
  });

  const rostroDocumento = await descriptorDe(modelos, peticion.documento);
  if (!rostroDocumento) return responder({ estado: 'sin_rostro_en_documento' });

  const rostroSelfie = await descriptorDe(modelos, peticion.selfie);
  if (!rostroSelfie) return responder({ estado: 'sin_rostro_en_selfie' });

  // Sale la distancia y nada más: los descriptores se quedan aquí y se
  // descartan con esta función.
  const distancia = Number(modelos.faceapi.euclideanDistance(rostroDocumento, rostroSelfie));
  return responder({ estado: 'comparado', distancia });
}

if (!parentPort) {
  throw new Error('hilo-de-inferencia se ejecuta como hilo de ComparadorFaceApi, no por separado');
}
const puerto = parentPort;

puerto.on('message', (peticion: PeticionComparacion) => {
  comparar(peticion)
    .catch((error: Error): RespuestaComparacion => ({ id: peticion.id, error: error.message }))
    .then((respuesta) => puerto.postMessage(respuesta));
});
