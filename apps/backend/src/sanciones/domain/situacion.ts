/**
 * Régimen de sanciones: tres estados, y solo hechos que el sistema registra.
 *
 * Ninguna sanción depende del juicio de otro usuario —no hay moderadores ni
 * puntaje—, y la única fuente de faltas es que la persona reportada cierre una
 * alerta declarando «Esta denuncia es falsa». Caducar sin respaldo no es falta:
 * una desaparición real puede no conseguir respaldo a tiempo.
 *
 * Con eso, dos faltas vienen siempre de dos personas distintas: no se puede
 * volver a denunciar a quien cerró una denuncia tuya como falsa, ni tener dos
 * denuncias abiertas sobre la misma persona. Por eso basta con tres estados.
 */

export enum EstadoSancion {
  NORMAL = 'NORMAL',
  /** Una persona declaró falsa una denuncia suya. */
  CON_FALTA = 'CON_FALTA',
  /** Dos personas distintas lo hicieron. */
  SUSPENDIDA = 'SUSPENDIDA',
}

/** Lo que una cuenta no puede hacer, con un código que la app sabe explicar. */
export type FuncionRestringida =
  /** Sus denuncias solo se difunden con el caso de la FELCC registrado. */
  | 'DIFUNDIR_SIN_CASO_FELCC'
  | 'DENUNCIAR'
  | 'FIRMAR'
  | 'RECIBIR_ALERTAS';

/** Códigos con que el servidor rechaza una acción restringida. */
export type CodigoRestriccion =
  | 'CUENTA_SUSPENDIDA'
  | 'DENUNCIA_SOBRE_PERSONA_BLOQUEADA'
  | 'DENUNCIA_ABIERTA_SOBRE_PERSONA'
  | 'DIFUSION_REQUIERE_CASO_FELCC'
  | 'LIMITE_ALERTAS_PROVISIONALES';

export function estadoSancion(suspendida: boolean, faltas: number): EstadoSancion {
  if (suspendida) return EstadoSancion.SUSPENDIDA;
  return faltas > 0 ? EstadoSancion.CON_FALTA : EstadoSancion.NORMAL;
}

/**
 * Qué pierde una cuenta en cada estado.
 *
 * Con una falta no se pierde la facultad de denunciar —I9: un hecho aislado y no
 * verificable nunca la quita—, solo la de difundir con la palabra propia como
 * único respaldo. Una desaparición real no queda desprotegida: la Policía debe
 * recibir la denuncia de inmediato, y con el caso FELCC la alerta sale entera.
 *
 * La suspensión sí lo quita todo, incluida la recepción de alertas: quien
 * denunció en falso dos veces a dos personas distintas no debe seguir viendo a
 * quién se busca y dónde.
 */
export function funcionesRestringidas(estado: EstadoSancion): FuncionRestringida[] {
  switch (estado) {
    case EstadoSancion.SUSPENDIDA:
      return ['DENUNCIAR', 'FIRMAR', 'RECIBIR_ALERTAS'];
    case EstadoSancion.CON_FALTA:
      return ['DIFUNDIR_SIN_CASO_FELCC'];
    default:
      return [];
  }
}

/**
 * Si los cierres «Es falsa» acumulados suspenden la cuenta.
 *
 * Se cuentan **personas distintas**, no cierres: la suspensión exige que el
 * patrón venga de más de una fuente. Dos cierres de la misma persona no deberían
 * existir —las reglas de denuncia lo impiden—, pero si existieran no bastarían.
 */
export const debeSuspenderse = (
  personasDistintasQueLaDeclararonFalsa: number,
  umbral: number,
): boolean => personasDistintasQueLaDeclararonFalsa >= umbral;
