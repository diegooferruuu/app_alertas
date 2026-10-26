import {
  Calzado,
  Circunstancia,
  ColorCabello,
  ColorOjos,
  ColorPiel,
  ColorPrenda,
  CondicionRelevante,
  Contextura,
  EstaturaRango,
  PrendaInferior,
  PrendaSuperior,
  SenaParticular,
  Sexo,
} from './domain/descripcion-fisica';

/**
 * Las listas cerradas del formulario, con su etiqueta en español.
 *
 * Hasta ahora solo las traducía la aplicación (`catalogo-denuncia.ts`), porque
 * el servidor nunca le mostraba una denuncia a una persona. La ficha pública sí
 * lo hace, y las etiquetas tienen que decir exactamente lo mismo que la app.
 *
 * Cada mapa se declara sobre el tipo de su lista: si el dominio agrega un
 * valor, esto deja de compilar en vez de mostrar `PANTALON_DEPORTIVO` a la
 * Policía.
 */

export const ETIQUETA_SEXO: Record<Sexo, string> = {
  FEMENINO: 'Femenino',
  MASCULINO: 'Masculino',
  OTRO: 'Otro',
};

export const ETIQUETA_ESTATURA: Record<EstaturaRango, string> = {
  MENOS_150: 'Menos de 1,50 m',
  DE_150_A_160: 'Entre 1,50 y 1,60 m',
  DE_160_A_170: 'Entre 1,60 y 1,70 m',
  DE_170_A_180: 'Entre 1,70 y 1,80 m',
  MAS_180: 'Más de 1,80 m',
};

export const ETIQUETA_CONTEXTURA: Record<Contextura, string> = {
  DELGADA: 'Delgada',
  MEDIA: 'Media',
  GRUESA: 'Gruesa',
};

export const ETIQUETA_COLOR_PIEL: Record<ColorPiel, string> = {
  CLARA: 'Clara',
  TRIGUENA: 'Trigueña',
  MORENA: 'Morena',
  OSCURA: 'Oscura',
};

export const ETIQUETA_COLOR_CABELLO: Record<ColorCabello, string> = {
  NEGRO: 'Negro',
  CASTANO_OSCURO: 'Castaño oscuro',
  CASTANO_CLARO: 'Castaño claro',
  RUBIO: 'Rubio',
  ROJIZO: 'Rojizo',
  CANOSO: 'Canoso',
  TENIDO: 'Teñido',
  SIN_CABELLO: 'Sin cabello',
};

export const ETIQUETA_COLOR_OJOS: Record<ColorOjos, string> = {
  NEGROS: 'Negros',
  CAFES_OSCUROS: 'Cafés oscuros',
  CAFES_CLAROS: 'Cafés claros',
  VERDES: 'Verdes',
  AZULES: 'Azules',
  GRISES: 'Grises',
};

export const ETIQUETA_SENA: Record<SenaParticular, string> = {
  CICATRIZ: 'Cicatriz',
  TATUAJE: 'Tatuaje',
  LENTES: 'Usa lentes',
  PROTESIS: 'Prótesis',
  LUNAR_VISIBLE: 'Lunar visible',
  OTRA: 'Otra',
};

export const ETIQUETA_PRENDA_SUPERIOR: Record<PrendaSuperior, string> = {
  POLERA: 'Polera',
  CAMISA: 'Camisa',
  BLUSA: 'Blusa',
  CHOMPA: 'Chompa',
  CASACA: 'Casaca',
  CHAQUETA: 'Chaqueta',
  ABRIGO: 'Abrigo',
  POLERON: 'Polerón',
  VESTIDO: 'Vestido',
  AGUAYO: 'Aguayo',
  OTRA: 'Otra',
};

export const ETIQUETA_PRENDA_INFERIOR: Record<PrendaInferior, string> = {
  PANTALON_JEAN: 'Pantalón jean',
  PANTALON_TELA: 'Pantalón de tela',
  PANTALON_DEPORTIVO: 'Pantalón deportivo',
  SHORT: 'Short',
  FALDA: 'Falda',
  POLLERA: 'Pollera',
  VESTIDO_LARGO: 'Vestido largo',
  OTRA: 'Otra',
};

export const ETIQUETA_CALZADO: Record<Calzado, string> = {
  ZAPATILLAS: 'Zapatillas',
  ZAPATOS: 'Zapatos',
  SANDALIAS: 'Sandalias',
  BOTAS: 'Botas',
  OJOTAS: 'Ojotas',
  DESCALZO: 'Descalzo',
};

export const ETIQUETA_COLOR_PRENDA: Record<ColorPrenda, string> = {
  BLANCO: 'Blanco',
  NEGRO: 'Negro',
  GRIS: 'Gris',
  AZUL: 'Azul',
  CELESTE: 'Celeste',
  ROJO: 'Rojo',
  VERDE: 'Verde',
  AMARILLO: 'Amarillo',
  NARANJA: 'Naranja',
  CAFE: 'Café',
  ROSADO: 'Rosado',
  MORADO: 'Morado',
  BEIGE: 'Beige',
  MULTICOLOR: 'Multicolor',
};

export const ETIQUETA_CIRCUNSTANCIA: Record<Circunstancia, string> = {
  SALIO_DE_CASA: 'Salió de casa y no volvió',
  NO_LLEGO_A_DESTINO: 'No llegó a donde iba',
  PERDIDA_DE_CONTACTO: 'Se perdió el contacto',
  NO_REGRESO_DE_TRABAJO_O_ESTUDIO: 'No regresó del trabajo o del estudio',
  EXTRAVIO_EN_VIA_PUBLICA: 'Se extravió en la vía pública',
};

export const ETIQUETA_CONDICION: Record<CondicionRelevante, string> = {
  REQUIERE_MEDICACION: 'Requiere medicación',
  DIFICULTAD_DE_ORIENTACION: 'Dificultad para orientarse',
  MOVILIDAD_REDUCIDA: 'Movilidad reducida',
};
