/**
 * Régimen de sanciones: tres estados, y solo hechos que el sistema registra.
 *
 * Ninguna sanción depende del juicio de otro usuario —no hay moderadores ni
 * puntaje—, y la única fuente de faltas es que la persona reportada cierre una
 * alerta declarando «Esta denuncia es falsa». Caducar no es falta: una
 * desaparición real puede durar más que una alerta.
 *
 * Con eso, dos faltas vienen siempre de dos personas distintas: no se puede
 * volver a denunciar a quien cerró una denuncia tuya como falsa, ni tener dos
 * denuncias abiertas sobre la misma persona. Por eso basta con tres estados.
 *
 * Cada falta, además, deja a la cuenta unos días sin denunciar (I9, reformulado
 * el 2026-10-04): una falta sola suspende por poco tiempo y nunca para siempre.
 * La suspensión definitiva exige faltas de dos personas distintas.
 */

export enum EstadoSancion {
  NORMAL = 'NORMAL',
  /** Una persona declaró falsa una denuncia suya. */
  CON_FALTA = 'CON_FALTA',
  /** Dos personas distintas lo hicieron. */
  SUSPENDIDA = 'SUSPENDIDA',
}

/** Lo que una cuenta no puede hacer, con un código que la app sabe explicar. */
export type FuncionRestringida = 'DENUNCIAR' | 'FIRMAR' | 'PROLONGAR' | 'RECIBIR_ALERTAS';

/** Códigos con que el servidor rechaza una acción restringida. */
export type CodigoRestriccion =
  | 'CUENTA_SUSPENDIDA'
  | 'CUENTA_SUSPENDIDA_TEMPORALMENTE'
  | 'DENUNCIA_SOBRE_PERSONA_BLOQUEADA'
  | 'DENUNCIA_ABIERTA_SOBRE_PERSONA'
  | 'LIMITE_ALERTAS_PROVISIONALES';

export function estadoSancion(suspendida: boolean, faltas: number): EstadoSancion {
  if (suspendida) return EstadoSancion.SUSPENDIDA;
  return faltas > 0 ? EstadoSancion.CON_FALTA : EstadoSancion.NORMAL;
}

const MS_POR_DIA = 24 * 3_600_000;

/**
 * Hasta cuándo dura la suspensión temporal que deja la última falta, o `null`
 * si ya terminó o nunca hubo falta.
 *
 * Se deriva de la fecha de la falta, que es de solo inserción: no hay un
 * proceso que la levante ni un campo que alguien pueda olvidar actualizar.
 */
export function finDeSuspensionTemporal(
  ultimaFalta: Date | null,
  dias: number,
  ahora: Date = new Date(),
): Date | null {
  if (!ultimaFalta) return null;
  const fin = new Date(ultimaFalta.getTime() + dias * MS_POR_DIA);
  return fin > ahora ? fin : null;
}

/**
 * Qué pierde una cuenta en cada estado.
 *
 * Mientras dura la suspensión temporal de una falta, la cuenta no registra,
 * firma ni prolonga denuncias, pero sigue recibiendo alertas y puede reportar
 * avistamientos: lo que se le quita es lo que difunde, no lo que ayuda. Pasados
 * esos días no pierde nada; la falta sigue contando para la suspensión.
 *
 * La suspensión definitiva lo quita todo, incluida la recepción de alertas:
 * quien denunció en falso a dos personas distintas no debe seguir viendo a
 * quién se busca y dónde.
 */
export function funcionesRestringidas(
  estado: EstadoSancion,
  suspendidaHasta: Date | null,
): FuncionRestringida[] {
  switch (estado) {
    case EstadoSancion.SUSPENDIDA:
      return ['DENUNCIAR', 'FIRMAR', 'PROLONGAR', 'RECIBIR_ALERTAS'];
    case EstadoSancion.CON_FALTA:
      return suspendidaHasta ? ['DENUNCIAR', 'FIRMAR', 'PROLONGAR'] : [];
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

/**
 * Una fecha como la lee una persona en Bolivia, para los mensajes de rechazo:
 * «11 de octubre de 2026, 14:30».
 */
export const fechaLegible = (fecha: Date): string =>
  new Intl.DateTimeFormat('es-BO', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: 'America/La_Paz',
  }).format(fecha);
