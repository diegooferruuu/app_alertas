/**
 * Comparación de nombres de personas.
 *
 * Se usa en dos momentos distintos del sistema y conviene no confundirlos:
 *
 *  - Al registrar el documento: el nombre declarado se contrasta contra el texto
 *    que el OCR leyó del carnet. Es una comprobación de consistencia, tolerante
 *    al ruido del OCR.
 *  - Al firmar la declaración jurada: lo que la persona escribe a mano se
 *    compara contra el nombre que quedó registrado. Aquí se exige coincidencia
 *    de contenido, aunque tolerando mayúsculas, tildes y espacios de más.
 */

/**
 * Minúsculas, sin tildes, sin puntuación y con espacios colapsados.
 *
 * La eñe se pliega a «n» a propósito: la descomposición NFD la separa en n más
 * tilde, y quitar la tilde es justamente lo que se busca. Conviene además, no
 * es un efecto colateral: el OCR confunde ñ con n con frecuencia y escribirla
 * resulta incómodo en algunos teclados, así que exigirla rechazaría firmas
 * legítimas de gente que se apellida Muñoz o Peña.
 */
export const normalizarNombre = (valor: string): string =>
  valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Partes del nombre con peso suficiente para comparar.
 *
 * Se descartan las de tres letras o menos: preposiciones y artículos como «de»,
 * «la» o «del» aparecen en casi cualquier texto y harían pasar comparaciones
 * que no significan nada.
 */
export const partesSignificativas = (nombre: string): string[] =>
  normalizarNombre(nombre)
    .split(' ')
    .filter((parte) => parte.length > 3);

/**
 * Cuántas partes del nombre deben aparecer en el documento.
 *
 * Exigir una sola es demasiado débil —«Juan» aparece en incontables carnets—, y
 * exigirlas todas es demasiado frágil, porque el OCR estropea palabras sueltas
 * con frecuencia. Dos es el punto donde la coincidencia deja de ser casual sin
 * volverse quebradiza.
 */
const MINIMO_PARTES_COINCIDENTES = 2;

export interface ResultadoComparacion {
  coincide: boolean;
  motivo?: string;
}

/**
 * Comprueba que el nombre declarado sea consistente con el texto del documento.
 *
 * Coincidir no significa que el documento sea de esa persona: el OCR extrae
 * datos, no autentica. Significa que lo declarado es consistente con lo leído.
 */
export const nombreConsistenteConDocumento = (
  nombreDeclarado: string,
  textoExtraido: string,
): ResultadoComparacion => {
  const partes = partesSignificativas(nombreDeclarado);

  if (partes.length === 0) {
    return {
      coincide: false,
      motivo: 'el nombre declarado no tiene ninguna parte comparable',
    };
  }

  const texto = normalizarNombre(textoExtraido);
  const encontradas = partes.filter((parte) => texto.includes(parte));

  // Con un nombre de una sola parte comparable no se puede exigir dos.
  const requeridas = Math.min(MINIMO_PARTES_COINCIDENTES, partes.length);

  if (encontradas.length < requeridas) {
    return {
      coincide: false,
      motivo:
        requeridas === 1
          ? 'el nombre no aparece en el documento'
          : `solo ${encontradas.length} de las partes del nombre aparece en el documento; hacen falta ${requeridas}`,
    };
  }

  return { coincide: true };
};

/**
 * Compara lo que la persona escribió a mano contra el nombre registrado.
 *
 * Tolerante a mayúsculas, tildes y espacios múltiples; exigente en el contenido.
 * El orden importa: escribir los apellidos al revés no es el mismo nombre.
 */
export const nombreEscritoCoincide = (
  nombreEscrito: string,
  nombreRegistrado: string,
): boolean => {
  const escrito = normalizarNombre(nombreEscrito);
  return escrito.length > 0 && escrito === normalizarNombre(nombreRegistrado);
};
