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

/**
 * Cuánto respaldo tiene el caso. Determina si se difunde.
 *
 * Hubo un tercer nivel, CORROBORADA, que daba 10 km y 7 días a quien registraba
 * el número de caso de la FELCC. Se quitó (2026-10-04): ese número no es
 * público, así que el sistema no podía comprobarlo, y un número inventado daba
 * más alcance, saltaba el límite de alertas y hasta borraba el efecto de una
 * falta. El único respaldo que queda es el que el sistema sí puede atribuir: la
 * declaración jurada firmada con el teléfono.
 */
export enum NivelConfianza {
  /** Creada. Visible solo para su autor. No se emite ninguna alerta. */
  REGISTRADA = 'REGISTRADA',
  /**
   * Firmada la declaración jurada: se difunde, con un radio y un plazo
   * deliberadamente cortos. La app la llama «Difundida».
   */
  PROVISIONAL = 'PROVISIONAL',
}

/** Si la denuncia sigue viva, y por qué dejó de estarlo. */
export enum EstadoDenuncia {
  /** En curso. */
  ACTIVA = 'ACTIVA',
  /**
   * Venció el plazo: muere la alerta, no el caso. No es una falta: una
   * desaparición real puede durar más que una alerta.
   */
  CADUCADA = 'CADUCADA',
  /** La cerró la persona reportada: «Estoy bien» o «Esta denuncia es falsa». */
  INVALIDADA = 'INVALIDADA',
  /**
   * Quien la presentó dio el caso por terminado: «La encontramos». La persona
   * reportada todavía puede declararla falsa (ver `CierresService.cerrar`).
   */
  CERRADA = 'CERRADA',
}

/**
 * Transiciones permitidas de nivel de confianza.
 *
 * El nivel solo sube, y una sola vez: firmar la declaración. Una declaración
 * firmada no se retira.
 */
const TRANSICIONES_NIVEL: Record<NivelConfianza, NivelConfianza[]> = {
  [NivelConfianza.REGISTRADA]: [NivelConfianza.PROVISIONAL],
  [NivelConfianza.PROVISIONAL]: [],
};

/**
 * Transiciones permitidas de estado.
 *
 * CADUCADA no es terminal: quien la presentó puede prolongar una alerta vencida,
 * dentro de su tope de prolongaciones, y vuelve a estar a la vista. INVALIDADA y
 * CERRADA sí lo son — la primera porque la persona reportada ya ejerció su
 * derecho a detenerla, y reactivarla por cualquier vía anularía esa protección.
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
