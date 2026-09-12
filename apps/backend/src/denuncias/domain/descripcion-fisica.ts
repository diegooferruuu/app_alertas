/**
 * Dominios cerrados del formulario de denuncia (§1 de la especificación).
 *
 * La defensa frente a la desinformación no se resuelve moderando el contenido
 * sino impidiendo que el contenido problemático pueda escribirse. Un campo
 * cerrado no difama, no exagera, no inventa y además es consultable; un campo de
 * texto libre es el único lugar por donde entra una acusación, el nombre de un
 * tercero o un rumor.
 *
 * Las listas siguen el habla boliviana, no un español neutro: acá se dice polera
 * y chompa, no camiseta y jersey, y existen prendas —la pollera, el aguayo— sin
 * las cuales una parte grande de la población quedaría mal descrita justo en el
 * momento en que más importa describirla bien.
 *
 * Cada lista se usa en tres sitios: valida el DTO, alimenta la restricción de la
 * base y se publica en la constancia. Cambiar un valor cambia los tres.
 */

export const SEXO = ['FEMENINO', 'MASCULINO', 'OTRO'] as const;

/**
 * Tramos de diez centímetros en vez de una cifra exacta.
 *
 * Quien reporta rara vez sabe la estatura exacta de la persona que busca, y un
 * número preciso e inventado describe peor que un tramo honesto.
 */
export const ESTATURA_RANGO = [
  'MENOS_150',
  'DE_150_A_160',
  'DE_160_A_170',
  'DE_170_A_180',
  'MAS_180',
] as const;

export const CONTEXTURA = ['DELGADA', 'MEDIA', 'GRUESA'] as const;

/**
 * Términos descriptivos de uso corriente, sin categoría étnica.
 *
 * `TRIGUENA` es el término que la gente usa y el que aparece en los formularios
 * policiales; omitirlo empujaría a todo el mundo hacia «morena» y volvería el
 * campo inútil para reconocer a alguien.
 */
export const COLOR_PIEL = ['CLARA', 'TRIGUENA', 'MORENA', 'OSCURA'] as const;

export const COLOR_CABELLO = [
  'NEGRO',
  'CASTANO_OSCURO',
  'CASTANO_CLARO',
  'RUBIO',
  'ROJIZO',
  'CANOSO',
  'TENIDO',
  'SIN_CABELLO',
] as const;

export const COLOR_OJOS = [
  'NEGROS',
  'CAFES_OSCUROS',
  'CAFES_CLAROS',
  'VERDES',
  'AZULES',
  'GRISES',
] as const;

export const SENA_PARTICULAR = [
  'CICATRIZ',
  'TATUAJE',
  'LENTES',
  'PROTESIS',
  'LUNAR_VISIBLE',
  'OTRA',
] as const;

export const PRENDA_SUPERIOR = [
  'POLERA',
  'CAMISA',
  'BLUSA',
  'CHOMPA',
  'CASACA',
  'CHAQUETA',
  'ABRIGO',
  'POLERON',
  'VESTIDO',
  'AGUAYO',
  'OTRA',
] as const;

export const PRENDA_INFERIOR = [
  'PANTALON_JEAN',
  'PANTALON_TELA',
  'PANTALON_DEPORTIVO',
  'SHORT',
  'FALDA',
  'POLLERA',
  'VESTIDO_LARGO',
  'OTRA',
] as const;

export const CALZADO = [
  'ZAPATILLAS',
  'ZAPATOS',
  'SANDALIAS',
  'BOTAS',
  'OJOTAS',
  'DESCALZO',
] as const;

/**
 * Una sola lista para la prenda de arriba y la de abajo.
 *
 * `CELESTE` va aparte de `AZUL` porque acá se nombran como colores distintos y
 * la diferencia sirve para reconocer a alguien a distancia.
 */
export const COLOR_PRENDA = [
  'BLANCO',
  'NEGRO',
  'GRIS',
  'AZUL',
  'CELESTE',
  'ROJO',
  'VERDE',
  'AMARILLO',
  'NARANJA',
  'CAFE',
  'ROSADO',
  'MORADO',
  'BEIGE',
  'MULTICOLOR',
] as const;

/**
 * Cómo se perdió el contacto. Ninguna de las cinco nombra a un tercero ni relata
 * un hecho: describen el vacío, no la causa. Esa es la diferencia entre una
 * circunstancia y una acusación (P3 y P5).
 */
export const CIRCUNSTANCIA = [
  'SALIO_DE_CASA',
  'NO_LLEGO_A_DESTINO',
  'PERDIDA_DE_CONTACTO',
  'NO_REGRESO_DE_TRABAJO_O_ESTUDIO',
  'EXTRAVIO_EN_VIA_PUBLICA',
] as const;

export const CONDICION_RELEVANTE = [
  'REQUIERE_MEDICACION',
  'DIFICULTAD_DE_ORIENTACION',
  'MOVILIDAD_REDUCIDA',
] as const;

export type Sexo = (typeof SEXO)[number];
export type EstaturaRango = (typeof ESTATURA_RANGO)[number];
export type Contextura = (typeof CONTEXTURA)[number];
export type ColorPiel = (typeof COLOR_PIEL)[number];
export type ColorCabello = (typeof COLOR_CABELLO)[number];
export type ColorOjos = (typeof COLOR_OJOS)[number];
export type SenaParticular = (typeof SENA_PARTICULAR)[number];
export type PrendaSuperior = (typeof PRENDA_SUPERIOR)[number];
export type PrendaInferior = (typeof PRENDA_INFERIOR)[number];
export type Calzado = (typeof CALZADO)[number];
export type ColorPrenda = (typeof COLOR_PRENDA)[number];
export type Circunstancia = (typeof CIRCUNSTANCIA)[number];
export type CondicionRelevante = (typeof CONDICION_RELEVANTE)[number];

/**
 * Deja un campo de valor múltiple en su forma canónica: sin repetidos y en orden
 * alfabético.
 *
 * No es cosmética. Estos valores entran en el hash del contenido de la denuncia,
 * y el hash se calcula sobre su unión en una cadena: si el mismo conjunto
 * pudiera llegar en dos órdenes distintos, la misma denuncia produciría dos
 * sellos distintos y la constancia dejaría de verificar contra sí misma.
 */
export const normalizarMultiple = <T extends string>(
  valores: readonly T[] | null | undefined,
): T[] | null => {
  if (!valores || valores.length === 0) return null;
  return [...new Set(valores)].sort();
};

/**
 * Expresión `IN (...)` para las restricciones de la base, en la forma que
 * Postgres normaliza, de modo que `migration:generate` no proponga recrearlas.
 */
export const comoRestriccion = (
  columna: string,
  valores: readonly string[],
): string =>
  `((${columna} IS NULL) OR ((${columna})::text = ANY ((ARRAY[${valores
    .map((v) => `'${v}'::character varying`)
    .join(', ')}])::text[])))`;
