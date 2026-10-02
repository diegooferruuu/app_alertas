import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { DeclaracionesService } from './declaraciones.service';
import { FirmasService } from './firmas.service';
import { FirmarDeclaracionDto } from './dto/firmar-declaracion.dto';
import { RegistrarCasoFelccDto } from './dto/registrar-caso-felcc.dto';
import { RegistrarClaveDto } from './dto/registrar-clave.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ETIQUETA_VINCULO, VINCULOS_VALIDOS } from './domain/vinculos';

@Controller('declaraciones')
@UseGuards(JwtAuthGuard)
export class DeclaracionesController {
  constructor(
    private readonly declaracionesService: DeclaracionesService,
    private readonly firmasService: FirmasService,
  ) {}

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

  /**
   * Vínculos que se pueden declarar.
   *
   * Los sirve el servidor para que la aplicación no mantenga su propia copia:
   * una lista desincronizada dejaría elegir un valor que el servidor rechaza.
   */
  @Get('vinculos')
  vinculos() {
    return VINCULOS_VALIDOS.map((valor) => ({
      valor,
      etiqueta: ETIQUETA_VINCULO[valor],
    }));
  }

  /**
   * La clave pública del teléfono. El teléfono la registra antes de cada
   * firma: es idempotente, y así nunca firma con un identificador vencido.
   */
  @Post('claves')
  async registrarClave(@CurrentUser() user: any, @Body() dto: RegistrarClaveDto) {
    return this.firmasService.registrarClave(user.userId, dto.clave_publica);
  }

  /** El hash del contenido que el teléfono va a firmar. */
  @Get('denuncias/:denunciaId/contenido')
  async contenidoAFirmar(
    @CurrentUser() user: any,
    @Param('denunciaId', ParseUUIDPipe) denunciaId: string,
  ) {
    return this.firmasService.contenidoAFirmar(user.userId, denunciaId);
  }

  @Post('denuncias/:denunciaId/firmar')
  async firmar(
    @CurrentUser() user: any,
    @Param('denunciaId') denunciaId: string,
    @Body() dto: FirmarDeclaracionDto,
  ) {
    return this.firmasService.firmar(user.userId, denunciaId, dto);
  }

  /**
   * La única vía de corroboración: el respaldo de una denuncia formal ante la
   * Policía. Se puede registrar antes o después de firmar.
   */
  @Post('denuncias/:denunciaId/caso-felcc')
  async registrarCasoFelcc(
    @CurrentUser() user: any,
    @Param('denunciaId') denunciaId: string,
    @Body() dto: RegistrarCasoFelccDto,
  ) {
    return this.firmasService.registrarCasoFelcc(
      user.userId,
      denunciaId,
      dto.numero_caso,
    );
  }
}
