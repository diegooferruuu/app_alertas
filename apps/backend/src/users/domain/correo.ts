/**
 * Forma canónica de un correo electrónico.
 *
 * El correo es la llave con la que alguien vuelve a entrar a su cuenta, y por
 * eso no puede depender de cómo lo escribió ese día. Dos defectos reales salían
 * de no normalizarlo:
 *
 *  - `Ana@demo.bo` no entraba en la cuenta de `ana@demo.bo`. Los teclados de
 *    los teléfonos capitalizan la primera letra y las sugerencias de
 *    autocompletado la capitalizan aún más seguido.
 *  - Un espacio al final —que el teclado añade al aceptar una sugerencia—
 *    tampoco entraba.
 *
 * En los dos casos el servidor respondía «Credenciales inválidas», que es
 * indistinguible de haberse equivocado de contraseña. Alguien podía quedarse
 * fuera de su propia cuenta sin entender por qué.
 *
 * Había además un problema más serio que el de entrar: sin normalizar, el mismo
 * correo en distinta caja creaba **dos cuentas distintas**. En un sistema cuya
 * garantía es la atribución, tener dos identidades para una persona no es una
 * molestia, es un agujero.
 */

/**
 * Minúsculas y sin espacios alrededor.
 *
 * Solo se recorta el exterior: un espacio en medio de un correo lo vuelve
 * inválido, y de eso se encarga la validación de formato, no esta función.
 *
 * La parte local de un correo es, según la norma, sensible a mayúsculas; en la
 * práctica ningún proveedor la trata así, y respetar la norma aquí costaría
 * dejar gente fuera de su cuenta por una letra.
 */
export const normalizarCorreo = (valor: string): string =>
  valor.trim().toLowerCase();

/** Un correo está en forma canónica si normalizarlo no lo cambia. */
export const correoEsCanonico = (valor: string): boolean =>
  valor === normalizarCorreo(valor);
