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
}

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
  ].join(SEPARADOR);

export const calcularHashRegistro = (campos: CamposDelRegistro): string =>
  sha256(serializarRegistro(campos));

/**
 * Contenido de la denuncia en el instante de declarar.
 *
 * Sella lo que se declaró: si la denuncia cambiara después, este hash dejaría
 * de corresponder. Por eso la edición se cierra al firmar.
 */
export interface ContenidoDenuncia {
  nombre_persona_buscada: string | null;
  ci_hash_persona_buscada: string;
  description: string;
  latitude: number;
  longitude: number;
}

export const calcularHashContenido = (contenido: ContenidoDenuncia): string =>
  sha256(
    [
      contenido.nombre_persona_buscada ?? '',
      contenido.ci_hash_persona_buscada,
      contenido.description,
      // Se fija la precisión: el mismo punto debe producir siempre el mismo
      // hash, y la representación decimal de un flotante puede variar.
      contenido.latitude.toFixed(7),
      contenido.longitude.toFixed(7),
    ].join(SEPARADOR),
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
