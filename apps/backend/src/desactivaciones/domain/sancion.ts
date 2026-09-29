import { EstadoCuenta } from '../../users/domain/estado-cuenta';

/**
 * Sanción graduada al denunciante cuando la persona reportada retira una alerta
 * (§5.4, invariante I9).
 *
 * El principio: **un patrón repetido identifica al malicioso; un caso aislado
 * no.** La desactivación no es verificable —quien la ejecutó pudo estar bajo
 * coacción, o no ser la persona reportada— así que un único evento nunca puede
 * acarrear una sanción permanente. Solo la repetición lo hace.
 */

export type RazonSancion =
  | 'primera_desactivacion'
  | 'segunda_desactivacion'
  | 'reincidencia_dirigida';

export interface Sancion {
  estado: EstadoCuenta;
  razon: RazonSancion;
  /** Si además hay que bloquear el documento para impedir el re-registro. */
  bloquearDocumento: boolean;
}

/**
 * Decide la sanción a partir del recuento de desactivaciones, ambos **contando
 * la que se acaba de registrar** (así que `recibidas >= 1` siempre).
 *
 * - `recibidas`: cuántas desactivaciones acumula el denunciante, de cualquier caso.
 * - `dirigidas`: cuántas van contra esta misma persona buscada.
 *
 * Se comprueba primero la reincidencia dirigida: denunciar dos veces a la misma
 * persona y que esa persona lo retire dos veces no admite lectura de buena fe, y
 * se sanciona sin esperar a que la cuenta acumule dos desactivaciones de casos
 * distintos. Con los umbrales por defecto ambos caminos coinciden en el número
 * —dos—, pero la razón registrada es distinta, y el umbral general podría
 * moverse sin tocar el dirigido.
 */
export function sancionPor(recibidas: number, dirigidas: number): Sancion {
  if (dirigidas >= 2) {
    return {
      estado: EstadoCuenta.SUSPENDIDA,
      razon: 'reincidencia_dirigida',
      bloquearDocumento: true,
    };
  }
  if (recibidas >= 2) {
    return {
      estado: EstadoCuenta.SUSPENDIDA,
      razon: 'segunda_desactivacion',
      bloquearDocumento: true,
    };
  }
  return {
    estado: EstadoCuenta.RESTRINGIDA,
    razon: 'primera_desactivacion',
    bloquearDocumento: false,
  };
}
