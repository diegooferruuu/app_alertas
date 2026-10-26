import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { DenunciasService } from './denuncias.service';
import { Denuncia } from './entities/denuncia.entity';
import { esMenorDeEdad } from './domain/minoria-edad';
import {
  htmlDeFicha,
  htmlFichaNoDisponible,
  tipoDeImagen,
  TipoDeImagen,
} from './ficha-publica';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Cabeceras de toda respuesta de la ficha.
 *
 * `no-store` porque la ficha tiene que desaparecer en cuanto se retira la
 * alerta: una copia guardada por el camino seguiría mostrando la foto. Y
 * `noindex` porque la foto de una persona buscada no debe terminar en un
 * buscador.
 */
const CABECERAS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

/** La página no ejecuta nada ni carga nada de fuera: solo su estilo y su foto. */
const POLITICA_DE_CONTENIDO =
  "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

/**
 * La ficha pública de una alerta, sin sesión.
 *
 * Es el único controlador sin `JwtAuthGuard`, a propósito: lo abre la Policía
 * desde el enlace del reporte de avistamiento, sin la aplicación. Muestra lo
 * mismo que vería en la app cualquier persona que no presentó la denuncia, con
 * las mismas reglas (`DenunciasService.fichaPublica`).
 *
 * Responde HTML y no JSON: quien la abre es un navegador. Por eso tampoco usa
 * `ParseUUIDPipe`, que respondería un 400 en JSON a un enlace mal copiado; aquí
 * recibe la misma página que una alerta retirada.
 */
@Controller('fichas')
export class FichasController {
  constructor(private readonly denunciasService: DenunciasService) {}

  @Get(':id')
  async ficha(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    res.set({ ...CABECERAS, 'Content-Security-Policy': POLITICA_DE_CONTENIDO });

    const denuncia = await this.visible(id);
    if (!denuncia) {
      res.status(404).type('html').send(htmlFichaNoDisponible());
      return;
    }

    // La dirección de la foto va absoluta: la vista previa de WhatsApp no
    // resuelve una relativa. Se arma con el mismo host por el que llegó la
    // petición, que es el que el teléfono sabe alcanzar.
    const urlFoto = (await this.fotoDe(denuncia))
      ? `${req.protocol}://${req.get('host')}${req.originalUrl.split('?')[0].replace(/\/$/, '')}/foto`
      : null;

    res.status(200).type('html').send(htmlDeFicha(denuncia, { urlFoto, ahora: new Date() }));
  }

  @Get(':id/foto')
  async foto(@Param('id') id: string, @Res() res: Response): Promise<void> {
    res.set(CABECERAS);

    const denuncia = await this.visible(id);
    const foto = denuncia ? await this.fotoDe(denuncia) : null;
    if (!foto) {
      res.status(404).end();
      return;
    }
    res.status(200).type(foto.tipo).send(foto.bytes);
  }

  /** La denuncia si su ficha se puede mostrar; nulo en cualquier otro caso, sin decir cuál. */
  private async visible(id: string): Promise<Denuncia | null> {
    if (!UUID.test(id)) return null;
    try {
      return await this.denunciasService.fichaPublica(id);
    } catch (error) {
      if (error instanceof NotFoundException) return null;
      throw error;
    }
  }

  /**
   * La primera foto, si es una imagen reconocible y la persona no es menor.
   *
   * La foto de un menor no debería existir —la base no la admite—, pero la
   * ficha no depende de eso: es la única ruta del sistema que la sirve sin
   * sesión.
   */
  private async fotoDe(
    denuncia: Denuncia,
  ): Promise<{ bytes: Buffer; tipo: TipoDeImagen } | null> {
    if (esMenorDeEdad(denuncia.fecha_nacimiento)) return null;

    const [primera] = await this.denunciasService.fotografiasDe(denuncia.id);
    if (!primera?.contenido) return null;

    const bytes = Buffer.from(primera.contenido, 'base64');
    const tipo = tipoDeImagen(bytes);
    return tipo ? { bytes, tipo } : null;
  }
}
