import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AvistamientosService } from './avistamientos.service';
import { UsoCanalDto } from './dto/uso-canal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * Las dos rutas del reporte de avistamiento.
 *
 * Exigen sesión, para que nadie infle la métrica desde fuera de la app, pero
 * **ninguna recibe al usuario**: no hay `@CurrentUser` ni `@Req`. Si el
 * método no tiene al usuario, no hay forma de que llegue a la base ni a un
 * registro (I2). Una prueba lo deja fijado.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class AvistamientosController {
  constructor(private readonly avistamientosService: AvistamientosService) {}

  /** A quién se entrega el reporte. La app no tiene ningún número escrito. */
  @Get('autoridad/contacto')
  contacto() {
    return this.avistamientosService.contactoDeLaAutoridad();
  }

  /**
   * 204 siempre: la app abre el canal antes de llamar aquí, así que nada de lo
   * que responda puede cambiar eso, ni conviene que diga algo de la alerta.
   */
  @Post('denuncias/:denunciaId/uso-canal')
  @HttpCode(204)
  async registrarUso(
    @Param('denunciaId', ParseUUIDPipe) denunciaId: string,
    @Body() dto: UsoCanalDto,
  ): Promise<void> {
    await this.avistamientosService.registrarUsoDeCanal(denunciaId, dto.canal);
  }
}
