/**
 * Cómo queda una cuenta eliminada.
 *
 * La fila no se borra: de ella cuelgan declaraciones juradas, faltas y claves
 * de firma que son de solo inserción (I4, I11), y una denuncia firmada tiene
 * que seguir pudiendo atribuirse. Lo que se borra son los datos personales; la
 * fila queda como lápida con el hash del documento.
 */

/** Lo que muestra cualquier lugar que todavía nombre a la cuenta. */
export const NOMBRE_DE_CUENTA_ELIMINADA = 'Cuenta eliminada';

/**
 * El correo que ocupa el lugar del real.
 *
 * La columna es obligatoria y única, así que no puede quedar vacía ni repetirse.
 * `.invalid` está reservado (RFC 2606): ningún mensaje puede llegar a esa
 * dirección, y nadie puede registrarla.
 */
export const correoDeCuentaEliminada = (id: string): string =>
  `eliminada-${id.toLowerCase()}@cuenta.invalid`;
