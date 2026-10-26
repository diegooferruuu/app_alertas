/**
 * El complemento del carnet: los uno o dos caracteres que van después del guion
 * en `12345678-1K`.
 *
 * Existe porque hay números de cédula duplicados, y el SEGIP distingue a sus
 * titulares con él. Para el sistema, el número y el complemento juntos son la
 * identidad del documento: el servidor los resume así (ver
 * `users/domain/documento-identidad.ts`) y este archivo solo prepara lo que se
 * escribe.
 */

/**
 * Lo que se va escribiendo en el campo: mayúsculas, sin guion ni espacios —la
 * gente copia «-1K» tal como lo ve— y como mucho dos caracteres. Limpiarlo al
 * escribir hace que el campo no pueda quedar con algo inválido.
 */
export const limpiarComplemento = (escrito: string): string =>
  escrito
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 2);

/** Lo que viaja al servidor: nada si el campo quedó vacío, como en la mayoría de los carnets. */
export const complementoParaEnviar = (escrito: string): string | undefined => {
  const limpio = limpiarComplemento(escrito);
  return limpio === '' ? undefined : limpio;
};
