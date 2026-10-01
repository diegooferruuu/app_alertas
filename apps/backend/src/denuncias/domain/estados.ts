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
  /** Respaldada por el número de caso de la FELCC. Radio ampliado. */
  CORROBORADA = 'CORROBORADA',
}

/** Si la denuncia sigue viva, y por qué dejó de estarlo. */
export enum EstadoDenuncia {
  /** En curso. */
  ACTIVA = 'ACTIVA',
  /**
   * Venció el plazo sin el caso de la FELCC: muere la alerta, no el caso. No es
   * una falta: una desaparición real puede no corroborarse a tiempo.
   */
  CADUCADA = 'CADUCADA',
  /** La cerró la persona reportada: «Estoy bien» o «Esta denuncia es falsa». */
  INVALIDADA = 'INVALIDADA',
  /** El caso terminó. */
  CERRADA = 'CERRADA',
}

/**
 * Transiciones permitidas de nivel de confianza.
 *
 * El nivel solo sube. No existe camino de vuelta: una denuncia corroborada no
 * puede degradarse a provisional, porque no hay ruta que retire el caso de la
 * FELCC una vez registrado.
 *
 * Firmar con el caso ya registrado aplica las dos transiciones en el mismo acto
 * (REGISTRADA → PROVISIONAL → CORROBORADA): no hay salto directo.
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
 * difundirse si se registra tarde el caso de la FELCC. INVALIDADA y CERRADA sí lo
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
