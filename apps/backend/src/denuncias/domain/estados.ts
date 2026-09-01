/**
 * Máquina de estados de una denuncia.
 *
 * Son dos ejes independientes y conviene no confundirlos:
 *
 *  - `NivelConfianza` mide **cuánto respaldo tiene** el caso, y de él dependen
 *    el alcance de la difusión y el plazo de vigencia.
 *  - `EstadoDenuncia` dice **si la denuncia sigue viva** y por qué dejó de estarlo.
 *
 * Una denuncia ACTIVA en nivel REGISTRADA existe pero no se difunde: ese es el
 * invariante I1 —crear y emitir son operaciones distintas— expresado en datos.
 */

/** Cuánto respaldo tiene el caso. Determina radio y caducidad. */
export enum NivelConfianza {
  /** Creada. Visible solo para su autor. No se emite ninguna alerta. */
  REGISTRADA = 'REGISTRADA',
  /** Firmada la declaración jurada. Se difunde con radio y plazo reducidos. */
  PROVISIONAL = 'PROVISIONAL',
  /** Respaldada por caso FELCC o por la firma de otra persona. Radio ampliado. */
  CORROBORADA = 'CORROBORADA',
}

/** Si la denuncia sigue viva, y por qué dejó de estarlo. */
export enum EstadoDenuncia {
  /** En curso. */
  ACTIVA = 'ACTIVA',
  /** Venció el plazo sin corroboración: muere la alerta, no el caso. */
  CADUCADA = 'CADUCADA',
  /** La persona reportada accionó el interruptor de desactivación. */
  INVALIDADA = 'INVALIDADA',
  /** El caso terminó. */
  CERRADA = 'CERRADA',
}

/**
 * Transiciones permitidas de nivel de confianza.
 *
 * El nivel solo sube. No existe camino de vuelta: una denuncia corroborada no
 * puede degradarse a provisional, porque la corroboración ya quedó sellada en
 * una declaración jurada que es append-only y no se puede retirar.
 */
const TRANSICIONES_NIVEL: Record<NivelConfianza, NivelConfianza[]> = {
  [NivelConfianza.REGISTRADA]: [NivelConfianza.PROVISIONAL],
  [NivelConfianza.PROVISIONAL]: [NivelConfianza.CORROBORADA],
  [NivelConfianza.CORROBORADA]: [],
};

/**
 * Transiciones permitidas de estado.
 *
 * CADUCADA no es terminal: una denuncia cuya alerta venció puede volver a
 * difundirse si aparece una corroboración tardía. INVALIDADA y CERRADA sí lo
 * son — la primera porque la persona reportada ya ejerció su derecho a
 * detenerla, y reactivarla por cualquier vía anularía esa protección.
 */
const TRANSICIONES_ESTADO: Record<EstadoDenuncia, EstadoDenuncia[]> = {
  [EstadoDenuncia.ACTIVA]: [
    EstadoDenuncia.CADUCADA,
    EstadoDenuncia.INVALIDADA,
    EstadoDenuncia.CERRADA,
  ],
  [EstadoDenuncia.CADUCADA]: [
    EstadoDenuncia.ACTIVA,
    EstadoDenuncia.INVALIDADA,
    EstadoDenuncia.CERRADA,
  ],
  [EstadoDenuncia.INVALIDADA]: [],
  [EstadoDenuncia.CERRADA]: [],
};

export const puedeTransicionarNivel = (
  desde: NivelConfianza,
  hacia: NivelConfianza,
): boolean => TRANSICIONES_NIVEL[desde].includes(hacia);

export const puedeTransicionarEstado = (
  desde: EstadoDenuncia,
  hacia: EstadoDenuncia,
): boolean => TRANSICIONES_ESTADO[desde].includes(hacia);

/**
 * Una denuncia se difunde solo si su nivel supera REGISTRADA y sigue activa.
 * Es la única definición de «difundible» del sistema: cualquier consulta que
 * decida a quién llega una alerta debe apoyarse en esto y no reimplementarlo.
 */
export const esDifundible = (
  nivel: NivelConfianza,
  estado: EstadoDenuncia,
): boolean =>
  estado === EstadoDenuncia.ACTIVA && nivel !== NivelConfianza.REGISTRADA;
