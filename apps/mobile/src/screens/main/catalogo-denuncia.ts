/**
 * Las listas cerradas del formulario de denuncia, con su etiqueta en español.
 *
 * Espejan el dominio del servidor (`denuncias/domain/descripcion-fisica.ts`),
 * que es quien manda: valida cada valor y la base lo comprueba otra vez. Aquí
 * viven solo porque un valor como `PANTALON_DEPORTIVO` no se le puede mostrar a
 * nadie tal cual, y esa traducción es trabajo de la aplicación.
 *
 * Si el servidor cambia una lista y esta no, la app ofrecerá una opción que el
 * servidor rechazará con un mensaje claro: se rompe visiblemente, no en
 * silencio.
 */

export interface Opcion {
  valor: string;
  etiqueta: string;
}

const op = (valor: string, etiqueta: string): Opcion => ({ valor, etiqueta });

export const SEXO: Opcion[] = [
  op('FEMENINO', 'Femenino'),
  op('MASCULINO', 'Masculino'),
  op('OTRO', 'Otro'),
];

export const ESTATURA_RANGO: Opcion[] = [
  op('MENOS_150', 'Menos de 1,50 m'),
  op('DE_150_A_160', 'Entre 1,50 y 1,60 m'),
  op('DE_160_A_170', 'Entre 1,60 y 1,70 m'),
  op('DE_170_A_180', 'Entre 1,70 y 1,80 m'),
  op('MAS_180', 'Más de 1,80 m'),
];

export const CONTEXTURA: Opcion[] = [
  op('DELGADA', 'Delgada'),
  op('MEDIA', 'Media'),
  op('GRUESA', 'Gruesa'),
];

export const COLOR_PIEL: Opcion[] = [
  op('CLARA', 'Clara'),
  op('TRIGUENA', 'Trigueña'),
  op('MORENA', 'Morena'),
  op('OSCURA', 'Oscura'),
];

export const COLOR_CABELLO: Opcion[] = [
  op('NEGRO', 'Negro'),
  op('CASTANO_OSCURO', 'Castaño oscuro'),
  op('CASTANO_CLARO', 'Castaño claro'),
  op('RUBIO', 'Rubio'),
  op('ROJIZO', 'Rojizo'),
  op('CANOSO', 'Canoso'),
  op('TENIDO', 'Teñido'),
  op('SIN_CABELLO', 'Sin cabello'),
];

export const COLOR_OJOS: Opcion[] = [
  op('NEGROS', 'Negros'),
  op('CAFES_OSCUROS', 'Cafés oscuros'),
  op('CAFES_CLAROS', 'Cafés claros'),
  op('VERDES', 'Verdes'),
  op('AZULES', 'Azules'),
  op('GRISES', 'Grises'),
];

export const SENA_PARTICULAR: Opcion[] = [
  op('CICATRIZ', 'Cicatriz'),
  op('TATUAJE', 'Tatuaje'),
  op('LENTES', 'Usa lentes'),
  op('PROTESIS', 'Prótesis'),
  op('LUNAR_VISIBLE', 'Lunar visible'),
  op('OTRA', 'Otra'),
];

export const PRENDA_SUPERIOR: Opcion[] = [
  op('POLERA', 'Polera'),
  op('CAMISA', 'Camisa'),
  op('BLUSA', 'Blusa'),
  op('CHOMPA', 'Chompa'),
  op('CASACA', 'Casaca'),
  op('CHAQUETA', 'Chaqueta'),
  op('ABRIGO', 'Abrigo'),
  op('POLERON', 'Polerón'),
  op('VESTIDO', 'Vestido'),
  op('AGUAYO', 'Aguayo'),
  op('OTRA', 'Otra'),
];

export const PRENDA_INFERIOR: Opcion[] = [
  op('PANTALON_JEAN', 'Pantalón jean'),
  op('PANTALON_TELA', 'Pantalón de tela'),
  op('PANTALON_DEPORTIVO', 'Pantalón deportivo'),
  op('SHORT', 'Short'),
  op('FALDA', 'Falda'),
  op('POLLERA', 'Pollera'),
  op('VESTIDO_LARGO', 'Vestido largo'),
  op('OTRA', 'Otra'),
];

export const CALZADO: Opcion[] = [
  op('ZAPATILLAS', 'Zapatillas'),
  op('ZAPATOS', 'Zapatos'),
  op('SANDALIAS', 'Sandalias'),
  op('BOTAS', 'Botas'),
  op('OJOTAS', 'Ojotas'),
  op('DESCALZO', 'Descalzo'),
];

export const COLOR_PRENDA: Opcion[] = [
  op('BLANCO', 'Blanco'),
  op('NEGRO', 'Negro'),
  op('GRIS', 'Gris'),
  op('AZUL', 'Azul'),
  op('CELESTE', 'Celeste'),
  op('ROJO', 'Rojo'),
  op('VERDE', 'Verde'),
  op('AMARILLO', 'Amarillo'),
  op('NARANJA', 'Naranja'),
  op('CAFE', 'Café'),
  op('ROSADO', 'Rosado'),
  op('MORADO', 'Morado'),
  op('BEIGE', 'Beige'),
  op('MULTICOLOR', 'Multicolor'),
];

export const CIRCUNSTANCIA: Opcion[] = [
  op('SALIO_DE_CASA', 'Salió de casa y no volvió'),
  op('NO_LLEGO_A_DESTINO', 'No llegó a donde iba'),
  op('PERDIDA_DE_CONTACTO', 'Se perdió el contacto'),
  op('NO_REGRESO_DE_TRABAJO_O_ESTUDIO', 'No regresó del trabajo o del estudio'),
  op('EXTRAVIO_EN_VIA_PUBLICA', 'Se extravió en la vía pública'),
];

export const CONDICION_RELEVANTE: Opcion[] = [
  op('REQUIERE_MEDICACION', 'Requiere medicación'),
  op('DIFICULTAD_DE_ORIENTACION', 'Dificultad para orientarse'),
  op('MOVILIDAD_REDUCIDA', 'Movilidad reducida'),
];

// ---------------------------------------------------------------------------
// De valores cerrados a texto legible
// ---------------------------------------------------------------------------

/**
 * Lo que hace falta para describir una denuncia en pantalla.
 *
 * Se declara aquí y no se importa de `denuncia.service` para que estas funciones
 * sirvan tanto a una denuncia completa como al bloque `denuncia` de una
 * constancia, que trae los mismos campos pero como texto plano.
 */
export interface DenunciaDescriptible {
  description?: string | null;
  sexo?: string | null;
  estatura_rango?: string | null;
  contextura?: string | null;
  color_piel?: string | null;
  color_cabello?: string | null;
  color_ojos?: string | null;
  senas_particulares?: string[] | string | null;
  circunstancia?: string | null;
  prenda_superior?: string | null;
  color_prenda_superior?: string | null;
  prenda_inferior?: string | null;
  color_prenda_inferior?: string | null;
  calzado?: string | null;
  condicion_relevante?: string[] | string | null;
}

const etiquetaDe = (opciones: Opcion[], valor?: string | null): string | null =>
  valor ? (opciones.find((o) => o.valor === valor)?.etiqueta ?? valor) : null;

const comoLista = (valor?: string[] | string | null): string[] => {
  if (!valor) return [];
  return Array.isArray(valor) ? valor : valor.split(',').filter(Boolean);
};

const etiquetasDe = (
  opciones: Opcion[],
  valor?: string[] | string | null,
): string[] =>
  comoLista(valor).map((v) => etiquetaDe(opciones, v) ?? v);

/**
 * Una línea para listas y tarjetas.
 *
 * Las denuncias anteriores al desglose no tienen campos cerrados; de esas se
 * muestra el relato que traen, que es todo lo que hay. No se inventa nada.
 */
export const resumenDescriptivo = (d: DenunciaDescriptible): string => {
  const partes = [
    etiquetaDe(SEXO, d.sexo),
    etiquetaDe(ESTATURA_RANGO, d.estatura_rango),
    etiquetaDe(CONTEXTURA, d.contextura)
      ? `contextura ${etiquetaDe(CONTEXTURA, d.contextura)!.toLowerCase()}`
      : null,
    vestimenta(d),
  ].filter(Boolean);

  if (partes.length > 0) return partes.join(' · ');
  return d.description ?? 'Sin descripción registrada.';
};

/** «Chompa azul y pantalón jean negro», o nada si no se registró la ropa. */
export const vestimenta = (d: DenunciaDescriptible): string | null => {
  const arriba = etiquetaDe(PRENDA_SUPERIOR, d.prenda_superior);
  const colorArriba = etiquetaDe(COLOR_PRENDA, d.color_prenda_superior);
  const abajo = etiquetaDe(PRENDA_INFERIOR, d.prenda_inferior);
  const colorAbajo = etiquetaDe(COLOR_PRENDA, d.color_prenda_inferior);

  const piezas = [
    arriba ? [arriba, colorArriba?.toLowerCase()].filter(Boolean).join(' ') : null,
    abajo ? [abajo, colorAbajo?.toLowerCase()].filter(Boolean).join(' ') : null,
  ].filter(Boolean);

  return piezas.length > 0 ? piezas.join(' y ') : null;
};

/** Pares etiqueta/valor para la vista de detalle, ya en orden de lectura. */
export const detalleDescriptivo = (
  d: DenunciaDescriptible,
): Array<{ etiqueta: string; valor: string }> => {
  const filas: Array<{ etiqueta: string; valor: string | null }> = [
    { etiqueta: 'Circunstancia', valor: etiquetaDe(CIRCUNSTANCIA, d.circunstancia) },
    { etiqueta: 'Sexo', valor: etiquetaDe(SEXO, d.sexo) },
    { etiqueta: 'Estatura', valor: etiquetaDe(ESTATURA_RANGO, d.estatura_rango) },
    { etiqueta: 'Contextura', valor: etiquetaDe(CONTEXTURA, d.contextura) },
    { etiqueta: 'Color de piel', valor: etiquetaDe(COLOR_PIEL, d.color_piel) },
    { etiqueta: 'Cabello', valor: etiquetaDe(COLOR_CABELLO, d.color_cabello) },
    { etiqueta: 'Ojos', valor: etiquetaDe(COLOR_OJOS, d.color_ojos) },
    {
      etiqueta: 'Señas particulares',
      valor: etiquetasDe(SENA_PARTICULAR, d.senas_particulares).join(', ') || null,
    },
    { etiqueta: 'Vestimenta', valor: vestimenta(d) },
    { etiqueta: 'Calzado', valor: etiquetaDe(CALZADO, d.calzado) },
    {
      etiqueta: 'A tener en cuenta',
      valor:
        etiquetasDe(CONDICION_RELEVANTE, d.condicion_relevante).join(', ') || null,
    },
  ];

  return filas.filter(
    (fila): fila is { etiqueta: string; valor: string } => fila.valor !== null,
  );
};
