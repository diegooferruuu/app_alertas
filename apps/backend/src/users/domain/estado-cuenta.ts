/**
 * Estado de una cuenta frente a las sanciones.
 *
 * Solo dos valores. Ya no existe la restricción temporal: con el régimen de
 * faltas, una cuenta con una falta sigue ACTIVA —lo que pierde se deriva de su
 * historial, ver `sanciones/domain/situacion.ts`—, y la única sanción que se
 * guarda en la cuenta es la suspensión.
 */
export enum EstadoCuenta {
  ACTIVA = 'ACTIVA',
  /**
   * Dos personas distintas declararon falsas denuncias suyas. No es un hecho
   * aislado, así que es duradera, y bloquea el documento para volver a
   * registrarse.
   */
  SUSPENDIDA = 'SUSPENDIDA',
}

/** Una cuenta suspendida no denuncia, no firma y no recibe alertas. */
export const estaSuspendida = (estado: EstadoCuenta): boolean =>
  estado === EstadoCuenta.SUSPENDIDA;
