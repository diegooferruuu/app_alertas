/**
 * Estado de una cuenta frente a las sanciones (§5.4).
 *
 * Reemplaza al antiguo booleano `is_suspended`. Tres valores en lugar de dos
 * porque la sanción es graduada: la primera desactivación recibida no puede
 * suspender de forma permanente —la desactivación no es verificable, y quien la
 * ejecutó pudo estar bajo coacción— así que existe un estado intermedio y
 * temporal entre estar plena y estar suspendida.
 */
export enum EstadoCuenta {
  /** Sin sanción. Puede todo. */
  ACTIVA = 'ACTIVA',
  /**
   * Restringida por una desactivación recibida. Temporal: `restringida_hasta`
   * marca cuándo se levanta. No puede crear denuncias nuevas; conserva el resto.
   */
  RESTRINGIDA = 'RESTRINGIDA',
  /**
   * Suspendida por un patrón: dos desactivaciones, o dos contra la misma
   * persona. No es un evento único, así que sí puede ser duradera.
   */
  SUSPENDIDA = 'SUSPENDIDA',
}

/**
 * Si una cuenta puede crear una denuncia nueva.
 *
 * La restricción se interpreta de forma perezosa contra `restringida_hasta`: una
 * cuenta RESTRINGIDA cuyo plazo ya venció vuelve a poder crear, sin necesitar un
 * proceso que le cambie el estado. La etiqueta guardada es el rastro de que fue
 * restringida; lo que decide es el plazo.
 *
 * Suspender no depende de plazo: mientras el estado sea SUSPENDIDA, no puede.
 */
export function puedeCrearDenuncia(
  estado: EstadoCuenta,
  restringidaHasta: Date | null,
  ahora: Date = new Date(),
): boolean {
  if (estado === EstadoCuenta.SUSPENDIDA) return false;
  if (estado === EstadoCuenta.RESTRINGIDA) {
    return !restringidaHasta || restringidaHasta <= ahora;
  }
  return true;
}

/** Una cuenta suspendida no participa en la difusión ni firma para difundir. */
export const estaSuspendida = (estado: EstadoCuenta): boolean =>
  estado === EstadoCuenta.SUSPENDIDA;
