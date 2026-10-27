import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONTACTO_CONFIG, ContactoConfig } from '../config/contacto.config';
import { htmlEliminarCuenta, htmlPoliticaDePrivacidad } from './paginas-legales';

/** Ni scripts ni nada de fuera: texto y su estilo. */
const POLITICA_DE_CONTENIDO =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * La política de privacidad y la página para eliminar la cuenta, sin sesión.
 *
 * Google Play pide las dos direcciones en la ficha de la aplicación, y la de
 * eliminación tiene que funcionar para quien ya la desinstaló. Se sirven en la
 * raíz del sitio (`/privacidad`, `/eliminar-cuenta`) y no bajo `/api`: son
 * páginas para personas, y esas son las direcciones que se publican
 * (ver `main.ts`).
 */
@Controller()
export class LegalController {
  constructor(private configService: ConfigService) {}

  private get correo(): string {
    return this.configService.getOrThrow<ContactoConfig>(CONTACTO_CONFIG).correo;
  }

  @Get('privacidad')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Content-Security-Policy', POLITICA_DE_CONTENIDO)
  @Header('X-Content-Type-Options', 'nosniff')
  privacidad(): string {
    return htmlPoliticaDePrivacidad(this.correo);
  }

  @Get('eliminar-cuenta')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Content-Security-Policy', POLITICA_DE_CONTENIDO)
  @Header('X-Content-Type-Options', 'nosniff')
  eliminarCuenta(): string {
    return htmlEliminarCuenta(this.correo);
  }
}
