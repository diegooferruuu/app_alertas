import { registerAs } from '@nestjs/config';

/**
 * Cómo se contacta a quien opera el sistema, y cómo le escribe el sistema.
 *
 * El correo es público a propósito: es el mismo de la ficha de Google Play y
 * de la política de privacidad, y por él llegan los pedidos de eliminación de
 * cuenta de quien ya no tiene la aplicación.
 *
 * El envío (SMTP) es opcional. Sin él, un reporte de contenido se guarda igual
 * y queda en el registro del servidor; lo único que se pierde es el aviso.
 */
export interface ContactoConfig {
  correo: string;
  /** La dirección pública del servidor, para los enlaces de los avisos. */
  sitio: string | null;
  smtp: { host: string; puerto: number; usuario: string; contrasena: string } | null;
}

export const CONTACTO_CONFIG = 'contacto';

export const contactoConfig = registerAs(CONTACTO_CONFIG, (): ContactoConfig => {
  const host = process.env.SMTP_HOST?.trim();
  const usuario = process.env.SMTP_USUARIO?.trim();
  const contrasena = process.env.SMTP_CONTRASENA?.trim();

  return {
    correo: process.env.CORREO_CONTACTO?.trim() || 'dferrufinoc@gmail.com',
    sitio: process.env.DOMINIO?.trim() ? `https://${process.env.DOMINIO.trim()}` : null,
    smtp:
      host && usuario && contrasena
        ? { host, puerto: Number(process.env.SMTP_PUERTO) || 465, usuario, contrasena }
        : null,
  };
});
