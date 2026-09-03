import { registerAs } from '@nestjs/config';

/**
 * Parámetros del ciclo de vida de una denuncia (§10 de la especificación).
 *
 * Ninguno de estos valores debe escribirse en el código de los servicios: el
 * radio y el plazo cambian durante la vida de un caso y se ajustan por política,
 * no por despliegue. Se leen por inyección para poder sustituirlos en pruebas.
 *
 * Todos son sobrescribibles por variable de entorno con el mismo nombre en
 * mayúsculas; los valores por defecto son los documentados aquí.
 */
export interface DenunciasConfig {
  /** Radio de difusión de una denuncia recién firmada. Reducido a propósito. */
  radioProvisionalM: number;
  /** Radio una vez corroborada, cuando hay respaldo del caso. */
  radioCorroboradoM: number;
  /** Radio para el vínculo TERCERO_NO_FAMILIAR: entra, pero con menos alcance. */
  radioTerceroNoFamiliarM: number;

  /** Horas que vive la alerta provisional antes de caducar sin corroboración. */
  caducidadProvisionalH: number;
  /** Horas que vive la alerta una vez corroborada. */
  caducidadCorroboradaH: number;
  /** Caducidad más corta para el vínculo TERCERO_NO_FAMILIAR. */
  caducidadTerceroNoFamiliarH: number;

  /** Cuántas firmas de terceros hacen falta para corroborar un caso. */
  corroboradoresNecesarios: number;

  /** Señalizaciones coincidentes de moderadores para que surta efecto. */
  senalizacionesNecesarias: number;
  /** Puntaje a partir del cual se deriva el rol de moderador. */
  umbralReputacionModerador: number;

  /** Horas de restricción tras la primera desactivación recibida. */
  restriccionPrimeraDesactivacionH: number;

  /**
   * Puntos de reputación que se descuentan por cada desactivación recibida.
   *
   * Es una penalización, no la sanción en sí: la sanción es el cambio de estado
   * de cuenta (5.4). Se descuenta en cada desactivación para que el puntaje
   * refleje el patrón, del que depende después el rol (fase 7).
   */
  penalizacionReputacionDesactivacion: number;

  /**
   * Cada cuántos minutos el planificador marca las alertas vencidas.
   *
   * No determina cuándo deja de difundirse una denuncia —de eso se encarga el
   * filtro por `expira_en` en cada consulta—, solo cada cuánto se refleja el
   * vencimiento en la columna `estado`.
   */
  intervaloCaducidadMin: number;

  /**
   * Antigüedad máxima de la ubicación de una persona para alertarla, en horas.
   *
   * La consulta opera sobre la última posición registrada, no sobre dónde está
   * ahora: es una limitación conocida del enfoque. Este umbral la acota — a
   * quien no reporta posición desde hace días no tiene sentido alertarlo por una
   * zona en la que probablemente ya no está, y contarlo como destinatario
   * falsearía la métrica de precisión de la segmentación.
   */
  antiguedadMaximaUbicacionH: number;

  /** Cada cuántos minutos el worker busca emisiones pendientes. */
  intervaloEmisionMin: number;

  /** Reintentos de una emisión fallida antes de darla por perdida. */
  maxIntentosEmision: number;

  /**
   * Precisión del geohash de un avistamiento. 6 caracteres ≈ 1.2 × 0.6 km,
   * que es la resolución de ~1 km que pide §3.3. Subirlo estrecha la zona y
   * acerca el dato a una ubicación identificable: no aumentar sin motivo.
   */
  precisionGeohash: number;
}

/** Lee un entero de entorno; si falta o no es válido, usa el valor por defecto. */
const entero = (valor: string | undefined, porDefecto: number): number => {
  const n = Number(valor);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : porDefecto;
};

export const DENUNCIAS_CONFIG = 'denuncias';

export const denunciasConfig = registerAs(
  DENUNCIAS_CONFIG,
  (): DenunciasConfig => ({
    radioProvisionalM: entero(process.env.RADIO_PROVISIONAL_M, 2_000),
    radioCorroboradoM: entero(process.env.RADIO_CORROBORADO_M, 10_000),
    radioTerceroNoFamiliarM: entero(process.env.RADIO_TERCERO_NO_FAMILIAR_M, 1_000),

    caducidadProvisionalH: entero(process.env.CADUCIDAD_PROVISIONAL_H, 24),
    caducidadCorroboradaH: entero(process.env.CADUCIDAD_CORROBORADA_H, 168),
    caducidadTerceroNoFamiliarH: entero(
      process.env.CADUCIDAD_TERCERO_NO_FAMILIAR_H,
      12,
    ),

    corroboradoresNecesarios: entero(process.env.CORROBORADORES_NECESARIOS, 1),

    senalizacionesNecesarias: entero(process.env.SENALIZACIONES_NECESARIAS, 3),
    umbralReputacionModerador: entero(
      process.env.UMBRAL_REPUTACION_MODERADOR,
      500,
    ),

    restriccionPrimeraDesactivacionH: entero(
      process.env.RESTRICCION_PRIMERA_DESACTIVACION_H,
      720,
    ),

    penalizacionReputacionDesactivacion: entero(
      process.env.PENALIZACION_REPUTACION_DESACTIVACION,
      50,
    ),

    intervaloCaducidadMin: entero(process.env.INTERVALO_CADUCIDAD_MIN, 5),

    antiguedadMaximaUbicacionH: entero(process.env.ANTIGUEDAD_MAXIMA_UBICACION_H, 72),
    intervaloEmisionMin: entero(process.env.INTERVALO_EMISION_MIN, 1),
    maxIntentosEmision: entero(process.env.MAX_INTENTOS_EMISION, 3),

    precisionGeohash: entero(process.env.PRECISION_GEOHASH, 6),
  }),
);
