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

  /**
   * Personas distintas que deben declarar falsas denuncias de una cuenta para
   * suspenderla. Se cuentan personas y no cierres: el patrón tiene que venir de
   * más de una fuente.
   */
  cierresConSancionParaSuspension: number;

  /**
   * Alertas provisionales que una cuenta puede tener difundiéndose a la vez.
   *
   * Es un límite de uso, no una sanción: frena a quien quisiera lanzar muchas
   * alertas sin respaldo sobre personas distintas. Las respaldadas por la FELCC
   * no cuentan.
   */
  limiteAlertasProvisionales: number;

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
   * Minutos sin renovar el arrendamiento tras los cuales una emisión
   * «procesando» se da por huérfana y se retoma.
   *
   * El arrendamiento se renueva después de cada lote, y un lote tarda como mucho
   * lo que el límite de espera de la pasarela (30 s). Cinco minutos sin
   * renovarlo solo ocurren si el trabajador murió. Bajarlo por debajo de lo que
   * tarda un lote haría que dos trabajadores enviaran la misma emisión a la vez.
   */
  arrendamientoEmisionMin: number;

  /**
   * Cada cuántos minutos se piden los recibos de entrega.
   *
   * Va en su propio ciclo y no en el de emisión: una consulta lenta a la
   * pasarela no debe demorar la salida de una alerta.
   */
  intervaloRecibosMin: number;

  /**
   * Minutos que se espera después de enviar antes de pedir el recibo. Expo
   * recomienda 15: suele estar listo antes, pero así hay margen. Bajarlo sirve
   * para una demostración; en producción, preguntar antes solo gasta consultas.
   */
  esperaReciboMin: number;
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

    cierresConSancionParaSuspension: entero(
      process.env.CIERRES_CON_SANCION_PARA_SUSPENSION,
      2,
    ),
    limiteAlertasProvisionales: entero(process.env.LIMITE_ALERTAS_PROVISIONALES, 2),

    intervaloCaducidadMin: entero(process.env.INTERVALO_CADUCIDAD_MIN, 5),

    antiguedadMaximaUbicacionH: entero(process.env.ANTIGUEDAD_MAXIMA_UBICACION_H, 72),
    intervaloEmisionMin: entero(process.env.INTERVALO_EMISION_MIN, 1),
    maxIntentosEmision: entero(process.env.MAX_INTENTOS_EMISION, 3),
    arrendamientoEmisionMin: entero(process.env.ARRENDAMIENTO_EMISION_MIN, 5),
    intervaloRecibosMin: entero(process.env.INTERVALO_RECIBOS_MIN, 5),
    esperaReciboMin: entero(process.env.ESPERA_RECIBO_MIN, 15),
  }),
);
