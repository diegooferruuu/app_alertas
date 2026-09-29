/**
 * El nombre de una cuenta, en sus partes.
 *
 * Se guarda separado en vez de como una sola cadena porque el nombre no es aquí
 * un dato de presentación: es la identidad a la que queda atribuida una
 * denuncia. Un campo único de «nombre completo» admite «Ana Q.», «QUISPE ANA» o
 * un apellido en el hueco del nombre, y ninguna de esas formas se puede comparar
 * con otra de manera fiable. Separado, el sistema sabe qué es cada parte.
 *
 * El orden de las partes sigue la convención boliviana: nombres primero,
 * apellido paterno y apellido materno después, que es el orden en que aparecen
 * en el carnet y el orden en que la gente escribe su nombre al firmar.
 */
export interface PartesDelNombre {
  primer_nombre: string;
  /** Mucha gente no tiene. Ausente es un dato, no un hueco por llenar. */
  segundo_nombre?: string | null;
  primer_apellido: string;
  segundo_apellido: string;
}

/**
 * Compone el nombre completo a partir de sus partes.
 *
 * Es la **única** forma en que se escribe `full_name`. Existe como función y no
 * como concatenación suelta en cada llamador porque `full_name` es el valor que
 * viaja a la constancia, al que se compara la firma escrita a mano y al que se
 * contrasta el texto del carnet: dos llamadores que lo compusieran distinto
 * —uno con doble espacio, otro sin recortar— producirían dos nombres que el
 * sistema tomaría por personas distintas.
 */
export const componerNombre = (partes: PartesDelNombre): string =>
  [
    partes.primer_nombre,
    partes.segundo_nombre,
    partes.primer_apellido,
    partes.segundo_apellido,
  ]
    .map((parte) => (parte ?? '').trim())
    .filter((parte) => parte.length > 0)
    .join(' ');

/**
 * Forma admitida de una parte del nombre.
 *
 * Letras, con tildes y eñe, y los separadores que aparecen de verdad dentro de
 * una parte: el espacio de «De La Cruz», el apóstrofo de «O'Connor» y el guion
 * de «Pérez-Gómez». Quedan fuera los dígitos y la puntuación, que en un nombre
 * solo entran por error de tecleo o por un intento de colar otra cosa en el
 * campo.
 */
export const FORMA_DE_PARTE = /^\p{L}+(?:[ '’-]\p{L}+)*$/u;

/**
 * Largo máximo de cada parte.
 *
 * Cuatro partes de 28 más los tres espacios caben en los 120 caracteres de
 * `full_name`, así que la composición nunca puede desbordar la columna.
 */
export const LARGO_MAXIMO_DE_PARTE = 28;
