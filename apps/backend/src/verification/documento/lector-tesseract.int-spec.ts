import sharp from 'sharp';
import { BadRequestException } from '@nestjs/common';
import { LectorTesseract } from './lector-tesseract';

/**
 * El lector de verdad, ejecutando OCR.
 *
 * Sin esto, el puerto quedaría cubierto solo por su doble, que es tanto como no
 * cubrirlo: la prueba diría que el código llama a una función.
 *
 * Se lee un «carnet» sintético con texto renderizado en vez de una fotografía
 * real. Mide lo que el sistema necesita —que el número y el apellido salgan
 * legibles— sin meter en el repositorio la imagen del documento de nadie.
 */
describe('LectorTesseract (integración, con OCR real)', () => {
  let lector: LectorTesseract;

  const carnet = async (apellido: string, numero: string) => {
    const svg = Buffer.from(`
      <svg width="1000" height="640">
        <rect width="1000" height="640" fill="#f2f4f7"/>
        <text x="40" y="80" font-family="DejaVu Sans" font-size="36" font-weight="bold">ESTADO PLURINACIONAL DE BOLIVIA</text>
        <text x="40" y="140" font-family="DejaVu Sans" font-size="32">CEDULA DE IDENTIDAD</text>
        <text x="40" y="280" font-family="DejaVu Sans" font-size="48" font-weight="bold">${apellido}</text>
        <text x="40" y="420" font-family="DejaVu Sans" font-size="52" font-weight="bold">${numero}</text>
      </svg>`);
    return sharp(svg).jpeg({ quality: 90 }).toBuffer();
  };

  beforeAll(() => {
    lector = new LectorTesseract();
  });

  afterAll(async () => {
    await lector.onModuleDestroy();
  });

  it('lee el número de documento', async () => {
    const texto = await lector.leer(await carnet('CALLISAYA', '8472913'));

    // Se compara sobre los dígitos, como hace el servicio: el OCR mete espacios
    // y saltos de línea donde le parece.
    expect(texto.replace(/\D/g, '')).toContain('8472913');
  }, 120_000);

  it('lee el apellido', async () => {
    const texto = await lector.leer(await carnet('CALLISAYA', '8472913'));

    expect(texto.toUpperCase()).toContain('CALLISAYA');
  }, 120_000);

  it('devuelve el texto crudo, sin interpretarlo', async () => {
    // El lector no decide si los datos coinciden: eso es una regla del dominio.
    // Devolver texto y no un veredicto es lo que permite cambiar de motor de OCR
    // sin tocar las reglas.
    const texto = await lector.leer(await carnet('MAMANI', '1234567'));

    expect(typeof texto).toBe('string');
    expect(texto.toUpperCase()).toContain('BOLIVIA');
  }, 120_000);

  it('una imagen ilegible es error del cliente, no del servidor', async () => {
    // Una foto que no se puede leer la arregla quien la mandó repitiéndola; un
    // 500 haría pensar que el sistema se rompió.
    //
    // Esta prueba encontró algo bastante peor que un código de estado mal
    // puesto: sin pasarle `errorHandler`, `tesseract.js` hace `throw` desde el
    // manejador de mensajes del hilo, fuera de toda cadena de promesas, y la
    // excepción sube sin que nadie pueda atraparla. Cualquiera que subiera un
    // archivo corrupto como documento tumbaba el proceso. Si alguien quita ese
    // `errorHandler`, esto vuelve a ponerse rojo.
    await expect(lector.leer(Buffer.from('esto no es una imagen'))).rejects.toThrow(
      BadRequestException,
    );
  }, 120_000);

  it('sigue leyendo después de una imagen ilegible', async () => {
    // El trabajador es compartido y vive todo el proceso: si un documento roto
    // lo dejara inservible, bastaría una foto mala de una persona para que
    // nadie más pudiera registrarse hasta el siguiente reinicio.
    await expect(lector.leer(Buffer.from('tampoco esto'))).rejects.toThrow(
      BadRequestException,
    );

    const texto = await lector.leer(await carnet('TICONA', '4455667'));

    expect(texto.replace(/\D/g, '')).toContain('4455667');
  }, 120_000);

  it('reutiliza el trabajador entre lecturas', async () => {
    // Crear uno por documento costaba unos 160 ms en cada registro. La versión
    // anterior de esta prueba comparaba cuánto tardaba cada lectura, y fallaba
    // sola: la segunda salía por 109 ms contra 108 ms de la primera, que es
    // ruido de la máquina, no una regresión. Lo que hay que afirmar no es que
    // la segunda lectura tarde menos, sino por qué debería: que el trabajador
    // se construye una sola vez.
    //
    // Va sobre un lector propio y no sobre el compartido porque éste ya creó el
    // suyo en las pruebas anteriores, y entonces el espía no vería nada.
    const crear = jest.spyOn(LectorTesseract.prototype as any, 'crearTrabajador');
    const propio = new LectorTesseract();

    try {
      const imagen = await carnet('VARGAS', '9988776');

      const primera = await propio.leer(imagen);
      const segunda = await propio.leer(imagen);

      expect(crear).toHaveBeenCalledTimes(1);
      // Y el trabajador reutilizado sigue sirviendo: uno vivo pero inutilizado
      // pasaría igual la afirmación de arriba.
      expect(primera.toUpperCase()).toContain('VARGAS');
      expect(segunda.toUpperCase()).toContain('VARGAS');
    } finally {
      await propio.onModuleDestroy();
      crear.mockRestore();
    }
  }, 180_000);

  it('dos lecturas simultáneas no se pisan', async () => {
    // Un trabajador de Tesseract atiende un reconocimiento a la vez.
    const [uno, dos] = await Promise.all([
      lector.leer(await carnet('QUISPE', '1111111')),
      lector.leer(await carnet('CHOQUE', '2222222')),
    ]);

    expect(uno.toUpperCase()).toContain('QUISPE');
    expect(dos.toUpperCase()).toContain('CHOQUE');
  }, 180_000);
});
