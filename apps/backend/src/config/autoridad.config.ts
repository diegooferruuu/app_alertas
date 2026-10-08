import { registerAs } from '@nestjs/config';

/**
 * A quién se entrega un reporte de avistamiento.
 *
 * Vive en la configuración y la app lo pide al servidor: así hay una sola
 * fuente, y ninguna copia del número escrita en el código del teléfono puede
 * quedar apuntando a la línea de emergencia real durante las pruebas. Fuera de
 * producción, `validarEntorno` no deja arrancar con algo que no sea un celular
 * de prueba.
 */
export interface AutoridadConfig {
  /** Lo que marca el botón «Llamar». En producción, 110. */
  telefono: string;
  /**
   * Número de WhatsApp en formato internacional sin «+», como lo pide
   * `wa.me`. Nulo mientras no se confirme que la autoridad tiene ese canal: sin
   * él, la app no muestra el botón.
   */
  mensajeria: string | null;
}

export const AUTORIDAD_CONFIG = 'autoridad';

/** Un celular boliviano escrito sin código de país: 8 dígitos, empieza con 6 o 7. */
const CELULAR_LOCAL = /^[67]\d{7}$/;

/** Deja un número como lo pide `wa.me`: solo dígitos y con código de país. */
export function paraWhatsApp(valor: string | undefined): string | null {
  const digitos = (valor ?? '').replace(/\D/g, '');
  if (!digitos) return null;
  return CELULAR_LOCAL.test(digitos) ? `591${digitos}` : digitos;
}

export const autoridadConfig = registerAs(
  AUTORIDAD_CONFIG,
  (): AutoridadConfig => ({
    telefono: (process.env.AUTORIDAD_TELEFONO ?? '').replace(/[\s-]/g, ''),
    mensajeria: paraWhatsApp(process.env.AUTORIDAD_MENSAJERIA),
  }),
);
