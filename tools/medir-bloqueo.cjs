/**
 * ¿Cuánto bloquea el bucle de eventos cada etapa del registro de documento?
 *
 * Node atiende todas las peticiones en un solo hilo. Si el OCR o la inferencia
 * facial lo ocupan, cualquier otra petición —consultar alertas cercanas, emitir
 * una notificación— espera. Esto mide cuánto.
 *
 * Uso, desde la raíz del repositorio:
 *   pnpm --dir apps/backend build && node tools/medir-bloqueo.cjs
 *
 * Medido el 2026-09-29 con el comparador real: con la inferencia en el hilo
 * principal, cada comparación lo bloqueaba 190–293 ms; con el hilo de
 * inferencia, 6 ms, que es el piso del propio reloj (lo mismo que en reposo).
 */
const { monitorEventLoopDelay, performance } = require('perf_hooks');
const path = require('path');
const { createRequire } = require('module');

// Las dependencias viven en el backend, no en la raíz del monorepo.
const BACKEND = path.join(__dirname, '..', 'apps', 'backend');
const req = createRequire(path.join(BACKEND, 'package.json'));
const sharp = req('sharp');

const DEMO = path.join(
  path.dirname(req.resolve('@vladmandic/face-api/package.json')),
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
  const { createWorker } = req('tesseract.js');
  let worker;
  await medir('OCR · arranque del worker', async () => {
    worker = await createWorker('spa');
  });
  await medir('OCR · reconocer el carnet', async () => {
    await worker.recognize(carnet);
  });
  await worker.terminate();

  // --- Comparación facial ---
  // Se mide el comparador real, tal como corre en el servidor —con su hilo de
  // inferencia—, y no una copia del algoritmo: una copia puede quedar desfasada
  // del código sin que nadie lo note. Por eso hace falta compilar antes.
  const { ComparadorFaceApi } = req('./dist/verification/rostros/comparador-face-api.js');
  const comparador = new ComparadorFaceApi();

  await medir('Facial · 1ª comparación (carga modelos)', () =>
    comparador.comparar(carnet, selfie),
  );
  await medir('Facial · comparación', () => comparador.comparar(carnet, selfie));
  await comparador.onModuleDestroy();

  console.log(
    '\n«bloqueo máx» es lo que esperaría, en el peor momento, cualquier otra\n' +
      'petición que llegue mientras corre la etapa.\n',
  );
})();
