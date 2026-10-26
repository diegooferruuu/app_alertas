import { createHash } from 'crypto';

/**
 * La identidad de un carnet: el número y, si lo tiene, su complemento.
 *
 * Hay números de cédula duplicados —personas distintas con la misma cifra,
 * herencia del registro anterior al SEGIP—, y el SEGIP no les cambia el número:
 * les agrega un código complemento, que se imprime pegado a él con un guion
 * (`12345678-1K`). El DS 4861 lo pone en el contenido de la cédula «en los casos
 * que corresponda».
 *
 * Dos personas con `12345678` y `12345678-1K` son personas distintas, y el
 * sistema las trata así en todo lo que se apoya en el documento: quién se
 * registra, a quién identifica una denuncia, quién puede retirarla y a quién
 * alcanza un bloqueo. Con el número solo eran una: la segunda no podía
 * registrarse, y la primera podía retirar alertas que no eran sobre ella.
 *
 * El lugar de expedición (LP, CB…) ya no es parte de la cédula y no entra.
 */

/** Número de cédula: solo dígitos. */
export const NUMERO_DE_CEDULA = /^\d{5,12}$/;

/**
 * Complemento: uno o dos caracteres, letras o dígitos. Los ejemplos públicos
 * son dígito y letra (`1A`, `1K`), pero no hay una especificación oficial
 * publicada del formato, así que no se exige más que esto. Se acepta en
 * minúsculas y se guarda en mayúsculas.
 */
export const COMPLEMENTO = /^[0-9A-Za-z]{1,2}$/;

/** El complemento en mayúsculas, sin espacios ni guiones. Vacío cuenta como ninguno. */
export const normalizarComplemento = (complemento?: string | null): string | null => {
  const limpio = (complemento ?? '').replace(/[\s-]/g, '').toUpperCase();
  return limpio === '' ? null : limpio;
};

/**
 * La forma canónica del documento, que es lo que se resume con SHA-256.
 *
 * Sin complemento, el número solo: el hash de quien no lo tiene es idéntico al
 * que se calculaba antes, así que nada de lo guardado cambia. Con complemento,
 * número, guion y complemento en mayúsculas: `12345678-1K`. El guion no es
 * decorativo: sin él, `12345678` con `1K` y `123456781` con `K` darían la misma
 * cadena.
 *
 * Es parte del formato público: la constancia explica cómo armarla, para que
 * cualquiera con el carnet en la mano pueda comprobar el hash.
 */
export const documentoCanonico = (numero: string, complemento?: string | null): string => {
  const c = normalizarComplemento(complemento);
  return c ? `${numero.trim()}-${c}` : numero.trim();
};

/** El documento nunca se guarda en claro: solo este hash (P6). */
export const hashDeDocumento = (numero: string, complemento?: string | null): string =>
  createHash('sha256').update(documentoCanonico(numero, complemento)).digest('hex');
