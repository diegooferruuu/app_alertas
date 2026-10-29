import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CONTACTO_CONFIG, ContactoConfig } from '../config/contacto.config';
import {
  htmlEliminarCuenta,
  htmlPoliticaDePrivacidad,
  htmlSeguridadInfantil,
} from './paginas-legales';

/** Ni scripts ni nada de fuera: texto y su estilo. */
const POLITICA_DE_CONTENIDO =
  "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * La política de privacidad, la página para eliminar la cuenta y los estándares
 * de seguridad infantil, sin sesión.
 *
 * Google Play pide las tres direcciones en la consola, y la de eliminación
 * tiene que funcionar para quien ya desinstaló la app. Se sirven en la raíz del
 * sitio (`/privacidad`, `/eliminar-cuenta`, `/seguridad-infantil`) y no bajo
 * `/api`: son páginas para personas, y esas son las direcciones que se publican
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

  @Get('seguridad-infantil')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Content-Security-Policy', POLITICA_DE_CONTENIDO)
  @Header('X-Content-Type-Options', 'nosniff')
  seguridadInfantil(): string {
    return htmlSeguridadInfantil(this.correo);
  }
}
