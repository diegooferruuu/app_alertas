import * as path from 'path';
import { monitorEventLoopDelay } from 'perf_hooks';
import { Worker } from 'worker_threads';
import sharp from 'sharp';
import { ComparadorFaceApi } from './comparador-face-api';
import { UMBRAL_DISTANCIA } from '../domain/comparacion-facial';

/**
 * El comparador de verdad, con el modelo cargado y rostros reales.
 *
 * Esto es lo que sostiene la afirmación «el sistema compara la selfie con la
 * foto del documento». Sin ejecutar el modelo, una prueba solo diría que el
 * código llama a una función.
 *
 * Las imágenes salen del paquete `@vladmandic/face-api`, que trae fotos de
 * muestra en `demo/`. Se usan desde `node_modules` en vez de copiarse al
 * repositorio: son fotografías de personas reales que ya vienen distribuidas con
 * la dependencia, y no hay motivo para duplicarlas aquí.
 */
const RAIZ_DEMO = path.join(
  path.dirname(require.resolve('@vladmandic/face-api/package.json')),
  'demo',
);

const muestra = (nombre: string) => path.join(RAIZ_DEMO, nombre);

describe('ComparadorFaceApi (integración, con modelo real)', () => {
  let comparador: ComparadorFaceApi;

  /** Un rostro suelto, recortado de una foto de grupo. */
  let rostroA: Buffer;
  /** El mismo rostro, degradado como se degrada la foto impresa de un carnet. */
  let rostroAComoCarnet: Buffer;
  /** Otra persona. */
  let rostroB: Buffer;

  beforeAll(async () => {
    comparador = new ComparadorFaceApi();

    // Las muestras son fotos de grupo; se recorta la mitad izquierda y la
    // derecha para quedarse con dos personas distintas y sin ambigüedad sobre
    // cuál detecta el modelo.
    const recortar = async (archivo: string, mitad: 'izquierda' | 'derecha') => {
      const imagen = sharp(muestra(archivo));
      const { width = 0, height = 0 } = await imagen.metadata();
      return sharp(muestra(archivo))
        .extract({
          left: mitad === 'izquierda' ? 0 : Math.floor(width / 2),
          top: 0,
          width: Math.floor(width / 2),
          height,
        })
        .resize(600)
        .jpeg({ quality: 92 })
        .toBuffer();
    };

    rostroA = await recortar('sample1.jpg', 'izquierda');
    rostroB = await recortar('sample3.jpg', 'derecha');

    // Lo que le pasa a un rostro al estar impreso en un carnet y fotografiado:
    // queda diminuto, recomprimido y con la luz cambiada.
    rostroAComoCarnet = await sharp(rostroA)
      .resize(140)
      .resize(600)
      .modulate({ brightness: 1.2 })
      .jpeg({ quality: 45 })
      .toBuffer();
  }, 120_000);

  // El modelo corre en un hilo aparte: si no se apaga, el proceso de pruebas no
  // termina nunca. En el servidor lo apaga Nest al cerrar.
  afterAll(() => comparador.onModuleDestroy());

  it('reconoce el mismo rostro pese a la degradación de un carnet', async () => {
    const resultado = await comparador.comparar(rostroAComoCarnet, rostroA);

    expect(resultado.estado).toBe('comparado');
    if (resultado.estado !== 'comparado') return;

    // Se afirma sobre la distancia y no sobre una decisión: el adaptador mide,
    // el núcleo decide. Compararla con el umbral aquí es comprobar que el
    // modelo separa los casos, que es lo que esta prueba cubre.
    expect(resultado.distancia).toBeLessThan(UMBRAL_DISTANCIA);
  }, 120_000);

  it('rechaza a otra persona', async () => {
    const resultado = await comparador.comparar(rostroAComoCarnet, rostroB);

    expect(resultado.estado).toBe('comparado');
    if (resultado.estado !== 'comparado') return;

    expect(resultado.distancia).toBeGreaterThan(UMBRAL_DISTANCIA);
  }, 120_000);

  it('deja margen entre el caso legítimo y el ajeno', async () => {
    // El valor de la comprobación está en la separación, no en un acierto
    // suelto: si ambos casos quedaran pegados al umbral, cualquier cambio de
    // cámara o de luz volcaría la decisión.
    const propio = await comparador.comparar(rostroAComoCarnet, rostroA);
    const ajeno = await comparador.comparar(rostroAComoCarnet, rostroB);
    if (propio.estado !== 'comparado' || ajeno.estado !== 'comparado') {
      throw new Error('No se pudo comparar alguna de las dos parejas');
    }

    expect(ajeno.distancia - propio.distancia).toBeGreaterThan(0.25);
  }, 180_000);

  it('dice que no hay rostro en el documento cuando no lo hay', async () => {
    const sinRostro = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#cccccc' },
    })
      .jpeg()
      .toBuffer();

    const resultado = await comparador.comparar(sinRostro, rostroA);

    expect(resultado.estado).toBe('sin_rostro_en_documento');
  }, 120_000);

  it('distingue que el rostro ausente es el de la selfie', async () => {
    const sinRostro = await sharp({
      create: { width: 400, height: 300, channels: 3, background: '#cccccc' },
    })
      .jpeg()
      .toBuffer();

    const resultado = await comparador.comparar(rostroA, sinRostro);

    // Importa cuál de las dos falló: una se arregla repitiendo la foto del
    // carnet y la otra repitiendo la selfie.
    expect(resultado.estado).toBe('sin_rostro_en_selfie');
  }, 120_000);

  it('dos comparaciones simultáneas no se pisan', async () => {
    // TensorFlow.js guarda estado global por backend. El comparador las
    // serializa; sin eso, dos registros a la vez podrían devolver basura.
    const [uno, dos] = await Promise.all([
      comparador.comparar(rostroAComoCarnet, rostroA),
      comparador.comparar(rostroAComoCarnet, rostroB),
    ]);

    if (uno.estado !== 'comparado' || dos.estado !== 'comparado') {
      throw new Error('Alguna comparación no se completó');
    }
    expect(uno.distancia).toBeLessThan(UMBRAL_DISTANCIA);
    expect(dos.distancia).toBeGreaterThan(UMBRAL_DISTANCIA);
  }, 180_000);

  it('no congela el servidor mientras compara', async () => {
    // Es la razón de ser del hilo. Con la inferencia en el hilo principal, cada
    // imagen lo bloqueaba unos 200 ms (medido): en ese tiempo no salía ninguna
    // alerta ni respondía ninguna otra petición.
    await comparador.comparar(rostroAComoCarnet, rostroA); // modelos ya cargados

    const retraso = monitorEventLoopDelay({ resolution: 5 });
    retraso.enable();
    await comparador.comparar(rostroAComoCarnet, rostroA);
    retraso.disable();

    expect(retraso.max / 1e6).toBeLessThan(100);
  }, 120_000);

  it('si el hilo muere a mitad, esa comparación falla y la siguiente funciona', async () => {
    // Lo que pasaría con una falta de memoria dentro del modelo: quien esperaba
    // recibe un error en vez de quedarse esperando para siempre, y el registro
    // siguiente arranca un hilo nuevo.
    const interno = comparador as unknown as {
      hilo: Worker | null;
      pendientes: Map<number, unknown>;
    };
    const enCurso = comparador.comparar(rostroAComoCarnet, rostroA);
    while (interno.pendientes.size === 0) {
      await new Promise((listo) => setTimeout(listo, 5));
    }
    await interno.hilo!.terminate();

    await expect(enCurso).rejects.toThrow(/terminó/);

    const siguiente = await comparador.comparar(rostroAComoCarnet, rostroA);
    expect(siguiente.estado).toBe('comparado');
  }, 120_000);
});
