/**
 * Comparación entre la selfie y el rostro impreso en el documento.
 *
 * **Esto no autentica a nadie.** Igual que el OCR extrae datos sin establecer
 * que la persona sea quien dice ser, la comparación facial establece una cosa
 * más estrecha: que el rostro de la selfie es *consistente* con el rostro
 * impreso en el documento que se fotografió. Sigue sin haber una autoridad que
 * confirme que ese documento es auténtico ni que pertenece a quien lo sostiene.
 *
 * Lo que sí añade es una barrera que antes no existía. Hasta ahora bastaba con
 * fotografiar el carnet de otra persona y declarar sus datos; ahora hace falta
 * además un rostro que se le parezca. Eso no es autenticación, pero sube el
 * costo de suplantar a alguien de «conseguir una foto del carnet» a «conseguir
 * una foto del carnet y parecerse a su titular».
 */

/**
 * Distancia euclídea máxima para considerar dos rostros consistentes.
 *
 * El descriptor del modelo es un vector de 128 dimensiones y su umbral
 * publicado es 0.6. Aquí se usa **0.45**, más estricto, por lo que se midió
 * sobre este mismo modelo:
 *
 *  - El mismo rostro degradado como se degrada la foto de un carnet —reducido a
 *    120 px, recomprimido a calidad 30, sobreexpuesto, en blanco y negro— se
 *    mantuvo entre 0.06 y 0.17, y solo llegó a 0.31 al rotarlo 8 grados.
 *  - Entre personas distintas, la distancia más corta observada fue 0.5979, por
 *    debajo del umbral publicado de 0.6. Con 0.6 ese par habría pasado.
 *
 * 0.45 deja unos 0.14 de margen sobre el peor caso legítimo y otros 0.15 por
 * debajo del mejor caso ilegítimo observado. Un rechazo injusto se arregla
 * tomando otra foto; una aceptación injusta deja una denuncia atribuida a quien
 * no la hizo, y esa no se arregla.
 *
 * **Es un punto de operación razonado, no una calibración.** Calibrar exigiría
 * un conjunto de pares etiquetados de carnets bolivianos y sus titulares, que no
 * existe aquí. Las tasas de falsa aceptación y falso rechazo sobre población
 * boliviana son desconocidas, y decirlo es parte de ser honesto sobre lo que el
 * sistema comprueba.
 */
export const UMBRAL_DISTANCIA = 0.45;

/** Por qué no se pudo comparar, cuando no se pudo. */
export type MotivoSinComparar =
  | 'sin_rostro_en_documento'
  | 'sin_rostro_en_selfie';

/**
 * Lo que devuelve el comparador: una **medición**, no una decisión.
 *
 * No trae `consistente` a propósito. El umbral es la política de seguridad del
 * subsistema y vive en el núcleo, junto al resto del dominio; el comparador solo
 * mide. Mientras el comparador corría en el mismo proceso la diferencia era
 * estética, pero deja de serlo en cuanto pase a ser una llamada de red: ahí,
 * devolver la decisión ya tomada sería confiarle la política a un servicio
 * remoto, que podría desplegarse con otro umbral sin que el núcleo se entere.
 *
 * El discriminante es una cadena y no un booleano porque el proyecto compila con
 * `strictNullChecks` desactivado, y ahí TypeScript no estrecha una unión
 * discriminada por `true`/`false`. Con literales de texto sí, y de paso los tres
 * desenlaces quedan al mismo nivel en vez de anidados.
 */
export type ResultadoComparacion =
  | { estado: 'comparado'; distancia: number }
  | { estado: MotivoSinComparar };

/**
 * Traduce una distancia en la única afirmación que el sistema puede sostener.
 *
 * Se compara con `<=` y no con `<`: el umbral es el último valor aceptable.
 */
export const esConsistente = (distancia: number): boolean =>
  distancia <= UMBRAL_DISTANCIA;

/**
 * Mensajes para la persona, separados por causa.
 *
 * Que no se encuentre un rostro y que los rostros no coincidan son problemas
 * distintos y se arreglan de forma distinta: uno pidiendo otra foto, el otro no
 * se arregla. Darles el mismo mensaje haría que alguien con una foto borrosa
 * creyera que el sistema lo acusa de suplantación.
 */
export const MENSAJES: Record<MotivoSinComparar | 'no_coincide', string> = {
  sin_rostro_en_documento:
    'No se pudo encontrar un rostro en la foto del documento. Tomá la foto del frente del carnet de nuevo, con buena luz y sin reflejos.',
  sin_rostro_en_selfie:
    'No se pudo encontrar un rostro en la selfie. Tomala de nuevo mirando a la cámara, con buena luz y sin nada que te cubra la cara.',
  no_coincide:
    'El rostro de la selfie no coincide con el del documento. Solo podés registrar tu propio documento de identidad.',
};

/**
 * Lo que esta comprobación **no** demuestra.
 *
 * Se declara en el código, y no solo en la memoria del proyecto, porque de aquí
 * sale lo que la interfaz tiene permitido decir. La limitación más seria es la
 * primera: sin detección de vivacidad, una fotografía impresa sostenida frente a
 * la cámara pasa igual que una persona.
 */
export const LIMITES_COMPARACION = [
  'No hay detección de vivacidad: una fotografía impresa o una pantalla sostenida frente a la cámara produce el mismo resultado que una persona presente.',
  'Que dos rostros sean consistentes no establece que el documento sea auténtico, ni que pertenezca a quien lo sostiene. Solo que quien se tomó la selfie se parece a quien aparece impreso.',
  'El umbral es un punto de operación razonado sobre mediciones propias, no una calibración con un conjunto de pares etiquetados. Las tasas de falsa aceptación y falso rechazo sobre población boliviana son desconocidas.',
  'Los gemelos idénticos y los parecidos muy cercanos no se distinguen de forma fiable con este modelo.',
];
