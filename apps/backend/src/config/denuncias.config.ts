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
   * Cada cuántos minutos el planificador marca las alertas vencidas.
   *
   * No determina cuándo deja de difundirse una denuncia —de eso se encarga el
   * filtro por `expira_en` en cada consulta—, solo cada cuánto se refleja el
   * vencimiento en la columna `estado`.
   */
  intervaloCaducidadMin: number;

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

    intervaloCaducidadMin: entero(process.env.INTERVALO_CADUCIDAD_MIN, 5),

    precisionGeohash: entero(process.env.PRECISION_GEOHASH, 6),
  }),
);
