import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/**
 * Reducción de las imágenes antes de enviarlas al servidor.
 *
 * La opción `quality` de la cámara es **compresión JPEG, no resolución**: una
 * foto de 12 megapíxeles sigue teniendo 12 megapíxeles por más que se baje la
 * calidad. Codificada en base64 crece otro tercio, y el registro de documento
 * manda tres de golpe —anverso, reverso y selfie— en un solo cuerpo. Así se
 * superaba el límite del servidor y la petición moría.
 *
 * Reducir aquí no pierde nada útil: el servidor ya recorta a 1 280 px para la
 * comparación facial, y para leer el número de un carnet con OCR sobra con este
 * tamaño. Lo que evita es mandar quince megabytes por datos móviles.
 */

/**
 * Lado mayor al que se reduce cada imagen.
 *
 * Un carnet mide unos 85 mm de ancho; a 1 600 px son casi 19 píxeles por
 * milímetro, de sobra para que el OCR lea el número y el nombre. Por encima solo
 * se gana peso.
 */
const LADO_MAXIMO = 1600;

/**
 * Compresión al recodificar.
 *
 * 0,7 sobre una imagen ya reducida no deja artefactos visibles en el texto
 * impreso de un carnet, que es lo delicado; el rostro tolera bastante más.
 */
const CALIDAD = 0.7;

/**
 * Deja una imagen lista para enviar: reducida, recomprimida y en base64.
 *
 * Recibe el URI del archivo y no el base64 de la cámara: manipular desde el
 * archivo evita cargar el original entero en memoria, que con tres imágenes en
 * un teléfono modesto es justamente lo que conviene no hacer.
 *
 * `anchoOriginal` sirve para no ampliar lo que ya es chico. El manipulador
 * escala en ambos sentidos, y agrandar una foto pequeña solo añadiría peso sin
 * añadir detalle.
 */
export async function prepararParaEnviar(
  uri: string,
  anchoOriginal?: number,
): Promise<string> {
  const contexto = ImageManipulator.manipulate(uri);

  if (!anchoOriginal || anchoOriginal > LADO_MAXIMO) {
    contexto.resize({ width: LADO_MAXIMO });
  }

  const imagen = await contexto.renderAsync();
  const resultado = await imagen.saveAsync({
    compress: CALIDAD,
    format: SaveFormat.JPEG,
    base64: true,
  });

  if (!resultado.base64) {
    throw new Error('No se pudo preparar la imagen para enviarla.');
  }
  return resultado.base64;
}
