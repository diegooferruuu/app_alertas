import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';
import { CONTACTO_CONFIG, ContactoConfig } from '../config/contacto.config';

/**
 * Le escribe a quien opera el sistema.
 *
 * Es el único correo que el sistema manda, y siempre al mismo destinatario: el
 * contacto público. A los usuarios no se les escribe nunca —no hay ni un solo
 * correo transaccional—, así que esto no puede convertirse en un canal para
 * filtrar datos de una persona a otra.
 *
 * Si el envío no está configurado, o falla, se registra y se sigue: lo que
 * motivó el aviso ya quedó guardado en la base, y es ahí donde se consulta.
 */
@Injectable()
export class CorreoService {
  private readonly logger = new Logger(CorreoService.name);
  private transporte: Transporter | null | undefined;

  constructor(private configService: ConfigService) {}

  private get config(): ContactoConfig {
    return this.configService.getOrThrow<ContactoConfig>(CONTACTO_CONFIG);
  }

  /** Se crea al primer envío: arrancar no tiene por qué conectarse a nada. */
  private obtenerTransporte(): Transporter | null {
    if (this.transporte !== undefined) return this.transporte;
    const smtp = this.config.smtp;
    this.transporte = smtp
      ? createTransport({
          host: smtp.host,
          port: smtp.puerto,
          secure: smtp.puerto === 465,
          auth: { user: smtp.usuario, pass: smtp.contrasena },
        })
      : null;
    return this.transporte;
  }

  async avisar(asunto: string, texto: string): Promise<void> {
    const transporte = this.obtenerTransporte();
    if (!transporte) {
      this.logger.warn(`Aviso sin enviar (SMTP no configurado): ${asunto}`);
      return;
    }
    try {
      await transporte.sendMail({
        from: this.config.smtp!.usuario,
        to: this.config.correo,
        subject: asunto,
        text: texto,
      });
    } catch (error) {
      this.logger.error(`No se pudo enviar el aviso «${asunto}»: ${(error as Error).message}`);
    }
  }
}
