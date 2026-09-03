import { Controller, Get, UseGuards } from '@nestjs/common';
import { DeclaracionesService } from './declaraciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('declaraciones')
@UseGuards(JwtAuthGuard)
export class DeclaracionesController {
  constructor(private readonly declaracionesService: DeclaracionesService) {}

  /**
   * Texto legal que debe leerse antes de firmar.
   *
   * Se devuelve el identificador de la versión junto al texto: la aplicación lo
   * reenvía al firmar, para que quede registrado contra qué versión se declaró
   * y no contra «la vigente», que puede cambiar.
   */
  @Get('texto-legal')
  async textoLegal() {
    const version = await this.declaracionesService.textoLegalVigente();
    return {
      version_id: version.id,
      version: version.version,
      texto: version.texto,
      hash_texto: version.hash_texto,
    };
  }
}
