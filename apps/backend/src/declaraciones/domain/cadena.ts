import { createHash } from 'crypto';

/**
 * Cadena de hashes del paquete probatorio.
 *
 * Cada declaración incorpora el hash de la anterior, de modo que la secuencia
 * completa queda encadenada. Alterar el contenido de un registro cambia su
 * hash; suprimir uno rompe el eslabón del siguiente. En ambos casos la ruptura
 * es detectable **sin confiar en el sistema**: basta recalcular los hashes sobre
 * los datos publicados en la constancia.
 *
 * Esto es lo que hace creíble el registro frente a su propio operador, que es
 * necesario porque no existe una entidad administradora que respalde nada.
 */

const sha256 = (valor: string): string =>
  createHash('sha256').update(valor, 'utf8').digest('hex');

/** Campos que entran en el hash de un registro, en orden fijo. */
export interface CamposDelRegistro {
  denuncia_id: string;
  usuario_id: string;
  ci_hash_declarante: string;
  vinculo_declarado: string;
  tipo: string;
  version_texto_legal_id: string;
  hash_texto_legal: string;
  texto_firmado: string;
  hash_contenido_denuncia: string;
  firmada_en: string;
  device_id: string | null;
  hash_anterior: string | null;
  /** Solo en las firmadas por el teléfono (H6.3). Ver `serializarRegistro`. */
  clave_publica_id?: string | null;
  firma_criptografica?: string | null;
}

/**
 * Los campos que se agregan al final cuando la declaración lleva la firma del
 * teléfono. La constancia los publica para que el verificador los sume.
 */
export const CAMPOS_REGISTRO_CON_FIRMA = ['clave_publica_id', 'firma_criptografica'] as const;

/**
 * Separador de campos: el carácter de control «unit separator» (0x1F).
 *
 * No puede ser un espacio. `texto_firmado` es un nombre completo, lleno de
 * espacios, así que con ese separador los campos «Ana Luz» + «Pérez» y «Ana» +
 * «Luz Pérez» producirían idéntica cadena y por lo tanto idéntico hash: dos
 * declaraciones distintas quedarían selladas como si fueran la misma.
 *
 * 0x1F no aparece en texto tecleado por una persona, pero se rechaza igualmente
 * en la entrada: de él depende que el sellado sea inequívoco.
 *
 * El orden y el separador son parte del formato. Cambiarlos invalidaría la
 * verificación de todas las constancias ya emitidas.
 */
const SEPARADOR = '\x1F';

/** Un campo con el separador dentro rompería la unicidad del sellado. */
export const contieneSeparador = (valor: string): boolean =>
  valor.includes(SEPARADOR);

/**
 * La firma del teléfono entra en el hash del registro, al final y **solo
 * cuando existe**.
 *
 * Que entre es lo que hace detectable quitarla o cambiarla después: sin eso,
 * quien opera la base podría borrar la firma de una declaración auténtica y la
 * cadena seguiría cuadrando. Que entre solo cuando existe deja intacta la
 * serialización de los registros anteriores, y con ella su hash: no hace
 * falta una versión nueva de la fórmula. No hay ambigüedad entre las dos
 * formas: ningún campo puede contener el separador.
 */
export const serializarRegistro = (campos: CamposDelRegistro): string =>
  [
    campos.denuncia_id,
    campos.usuario_id,
    campos.ci_hash_declarante,
    campos.vinculo_declarado,
    campos.tipo,
    campos.version_texto_legal_id,
    campos.hash_texto_legal,
    campos.texto_firmado,
    campos.hash_contenido_denuncia,
    campos.firmada_en,
    campos.device_id ?? '',
    campos.hash_anterior ?? '',
    ...(campos.firma_criptografica
      ? [campos.clave_publica_id ?? '', campos.firma_criptografica]
      : []),
  ].join(SEPARADOR);

export const calcularHashRegistro = (campos: CamposDelRegistro): string =>
  sha256(serializarRegistro(campos));

/**
 * Contenido de la denuncia en el instante de declarar.
 *
 * Sella lo que se declaró: si la denuncia cambiara después, este hash dejaría
 * de corresponder. Por eso la edición se cierra al firmar.
 *
 * Los campos llegan ya en su forma canónica de texto —fechas en ISO, valores
 * múltiples ordenados y unidos por coma, coordenadas con precisión fija— porque
 * el sellado no puede depender de cómo cada llamador decida representar un dato.
 */
export type ContenidoDenuncia = Record<string, string>;

/**
 * Versiones de la fórmula del hash de contenido.
 *
 * La fórmula no se cambia en su sitio: se añade una versión. Cuando el
 * formulario pasó de un relato libre a campos de dominio cerrado, sellar los
 * campos nuevos con la fórmula vieja habría dejado la ropa y la circunstancia
 * fuera del sello —alterables sin que la cadena lo notara— y reescribir la
 * fórmula habría vuelto inverificable toda constancia ya emitida. Conviven.
 *
 * Cada denuncia recuerda con qué versión se selló, y la constancia publica el
 * orden correspondiente; el verificador lo lee del propio documento y no
 * necesita conocer ninguna de las dos.
 */
export const ORDEN_CONTENIDO_POR_VERSION: Record<number, readonly string[]> = {
  // Formulario original: un relato libre y poco más.
  1: [
    'nombre_persona_buscada',
    'ci_hash_persona_buscada',
    'description',
    'latitude',
    'longitude',
  ],
  // Formulario de campos cerrados. Sin `description`, que se retiró.
  2: [
    'nombre_persona_buscada',
    'ci_hash_persona_buscada',
    'fecha_nacimiento',
    'sexo',
    'estatura_rango',
    'contextura',
    'color_piel',
    'color_cabello',
    'color_ojos',
    'senas_particulares',
    'ultimo_avistamiento_en',
    'prenda_superior',
    'color_prenda_superior',
    'prenda_inferior',
    'color_prenda_inferior',
    'calzado',
    'circunstancia',
    'condicion_relevante',
    'latitude',
    'longitude',
  ],
};

/** La versión con la que se sellan las denuncias nuevas. */
export const VERSION_FORMULA_ACTUAL = 2;

export const ordenDeContenido = (version: number): readonly string[] => {
  const orden = ORDEN_CONTENIDO_POR_VERSION[version];
  if (!orden) {
    throw new Error(
      `No existe la versión ${version} de la fórmula de contenido de denuncia`,
    );
  }
  return orden;
};

/**
 * Sella el contenido de una denuncia con la fórmula de su versión.
 *
 * Un campo ausente o nulo entra como cadena vacía, igual que en el hash del
 * registro y que en el procedimiento publicado.
 */
export const calcularHashContenido = (
  contenido: ContenidoDenuncia,
  version: number,
): string =>
  sha256(
    ordenDeContenido(version)
      .map((campo) => contenido[campo] ?? '')
      .join(SEPARADOR),
  );

/** Verifica que un registro no fue alterado desde que se selló. */
export const registroIntacto = (
  campos: CamposDelRegistro,
  hashRegistro: string,
): boolean => calcularHashRegistro(campos) === hashRegistro;

/**
 * Verifica una secuencia completa, en orden de firma.
 *
 * Devuelve el índice del primer eslabón roto, o `null` si la cadena está
 * íntegra. Comprueba dos cosas distintas: que cada registro corresponda a su
 * propio hash, y que cada uno apunte al hash del anterior.
 */
export const verificarCadena = (
  registros: Array<CamposDelRegistro & { hash_registro: string }>,
): number | null => {
  let hashEsperadoAnterior: string | null = null;

  for (let i = 0; i < registros.length; i++) {
    const registro = registros[i];

    if (registro.hash_anterior !== hashEsperadoAnterior) return i;
    if (!registroIntacto(registro, registro.hash_registro)) return i;

    hashEsperadoAnterior = registro.hash_registro;
  }

  return null;
};
