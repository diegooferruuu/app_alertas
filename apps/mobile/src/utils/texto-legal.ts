/**
 * El texto legal tal como lo lee quien declara.
 *
 * El servidor guarda y sirve el texto con un marcador en el lugar del vínculo
 * —«Declaro bajo juramento ser {{VINCULO}} de la persona…»—, el mismo para
 * todos. Aquí se pone en su lugar el vínculo que la persona eligió.
 *
 * Lo que se firma no cambia: el teléfono firma el hash del texto **con** el
 * marcador y, aparte, el vínculo. Los dos juntos determinan exactamente el
 * texto que se mostró, así que mostrarlo completo no altera nada de lo que se
 * verifica después.
 */
export const MARCADOR_VINCULO = '{{VINCULO}}';

/**
 * El texto partido donde va el vínculo. Entre cada par de partes va el
 * vínculo: así la pantalla puede resaltarlo.
 */
export const partesDelTexto = (texto: string): string[] => texto.split(MARCADOR_VINCULO);

/** El texto con el vínculo escrito en lugar del marcador, todas las veces que aparezca. */
export const textoConVinculo = (texto: string, vinculo: string): string =>
  partesDelTexto(texto).join(vinculo);

/** «madre» → «Madre». El servidor manda las etiquetas para ir dentro de una frase. */
export const conMayuscula = (etiqueta: string): string =>
  etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1);
