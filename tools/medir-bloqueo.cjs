/**
 * ¿Cuánto bloquea el bucle de eventos cada etapa del registro de documento?
 *
 * Node atiende todas las peticiones en un solo hilo. Si el OCR o la inferencia
 * facial lo ocupan, cualquier otra petición —consultar alertas cercanas, emitir
 * una notificación— espera. Esto mide cuánto.
 */
const { monitorEventLoopDelay, performance } = require('perf_hooks');
const path = require('path');
const sharp = require('sharp');

const DEMO = path.join(
  path.dirname(require.resolve('@vladmandic/face-api/package.json')),
  'demo',
);

/** Mide el retraso del bucle mientras corre `tarea`. */
async function medir(nombre, tarea) {
  const h = monitorEventLoopDelay({ resolution: 5 });
  h.enable();
  const t0 = performance.now();
  await tarea();
  const total = performance.now() - t0;
  h.disable();
  const ms = (n) => (n / 1e6).toFixed(1);
  console.log(
    `  ${nombre.padEnd(34)} total ${total.toFixed(0).padStart(6)} ms  ` +
      `| bloqueo máx ${ms(h.max).padStart(7)} ms  | p99 ${ms(h.percentile(99)).padStart(7)} ms`,
  );
  return total;
}

(async () => {
  // Un «carnet» con texto y rostro, como el que sube una persona.
  const { width, height } = await sharp(path.join(DEMO, 'sample1.jpg')).metadata();
  const retrato = await sharp(path.join(DEMO, 'sample1.jpg'))
    .extract({ left: 0, top: 0, width: Math.floor(width / 2), height })
    .resize(200, 260, { fit: 'cover' })
    .toBuffer();

  const svg = Buffer.from(`
    <svg width="1000" height="640">
      <rect width="1000" height="640" fill="#f2f4f7"/>
      <text x="40" y="70" font-family="DejaVu Sans" font-size="34" font-weight="bold">ESTADO PLURINACIONAL DE BOLIVIA</text>
      <text x="300" y="250" font-family="DejaVu Sans" font-size="40" font-weight="bold">CALLISAYA</text>
      <text x="300" y="310" font-family="DejaVu Sans" font-size="40" font-weight="bold">MAMANI</text>
      <text x="300" y="470" font-family="DejaVu Sans" font-size="44" font-weight="bold">8472913</text>
    </svg>`);
  const carnet = await sharp(svg)
    .composite([{ input: retrato, left: 50, top: 200 }])
    .jpeg({ quality: 85 })
    .toBuffer();

  const selfie = await sharp(path.join(DEMO, 'sample1.jpg'))
    .extract({ left: 0, top: 0, width: Math.floor(width / 2), height })
    .resize(600)
    .jpeg({ quality: 90 })
    .toBuffer();

  console.log('\nBloqueo del bucle de eventos por etapa\n');

  // --- referencia: cuánto se desvía el bucle sin hacer nada pesado ---
  await medir('reposo (referencia)', async () => {
    await new Promise((r) => setTimeout(r, 1500));
  });

  // --- OCR ---
  const { createWorker } = require('tesseract.js');
  let worker;
  await medir('OCR · arranque del worker', async () => {
    worker = await createWorker('spa');
  });
  await medir('OCR · reconocer el carnet', async () => {
    await worker.recognize(carnet);
  });
  await worker.terminate();

  // --- Comparación facial ---
  const tf = require('@tensorflow/tfjs');
  const wasm = require('@tensorflow/tfjs-backend-wasm');
  const faceapi = require('@vladmandic/face-api/dist/face-api.node-wasm.js');

  const raizWasm = path.join(
    path.dirname(require.resolve('@tensorflow/tfjs-backend-wasm/package.json')),
    'dist/',
  );
  const raizModelos = path.join(
    path.dirname(require.resolve('@vladmandic/face-api/package.json')),
    'model',
  );

  await medir('Facial · cargar modelos', async () => {
    wasm.setWasmPaths(raizWasm);
    await tf.setBackend('wasm');
    await tf.ready();
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(raizModelos);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(raizModelos);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(raizModelos);
  });

  const opciones = new faceapi.SsdMobilenetv1Options({
    minConfidence: 0.5,
    maxResults: 1,
  });

  const descriptor = async (buf) => {
    const { data, info } = await sharp(buf)
      .resize({ width: 1280, height: 1280, fit: 'inside', withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const t = tf.tensor3d(new Uint8Array(data), [info.height, info.width, 3], 'int32');
    try {
      const caras = await faceapi
        .detectAllFaces(t, opciones)
        .withFaceLandmarks()
        .withFaceDescriptors();
      return caras[0]?.descriptor ?? null;
    } finally {
      tf.dispose(t);
    }
  };

  await medir('Facial · inferencia sobre 2 imágenes', async () => {
    const a = await descriptor(carnet);
    const b = await descriptor(selfie);
    if (a && b) faceapi.euclideanDistance(a, b);
  });

  console.log(
    '\n«bloqueo máx» es lo que esperaría, en el peor momento, cualquier otra\n' +
      'petición que llegue mientras corre la etapa.\n',
  );
})();
