import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CierresService } from './cierres.service';
import { CerrarDenunciaDto } from './dto/cerrar-denuncia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * El cierre de una alerta por la persona reportada.
 *
 * Las dos rutas operan siempre sobre quien está autenticado: no reciben a quién
 * afectan, lo deducen del documento registrado en la sesión. No hay forma de
 * pedir «cierra la denuncia de otro» porque no hay parámetro donde decirlo.
 */
@Controller()
@UseGuards(JwtAuthGuard)
export class CierresController {
  constructor(private readonly cierresService: CierresService) {}

  /** Las denuncias que identifican a quien consulta. Nunca las de otro. */
  @Get('cierres/denuncias')
  async denunciasQueMeIdentifican(@CurrentUser() user: any) {
    return this.cierresService.denunciasQueMeIdentifican(user.userId);
  }

  /**
   * Es POST y no DELETE: no se borra nada. La denuncia queda registrada y
   * verificable (I7); lo que se detiene es su difusión.
   */
  @Post('denuncias/:denunciaId/cierre')
  async cerrar(
    @CurrentUser() user: any,
    @Param('denunciaId', ParseUUIDPipe) denunciaId: string,
    @Body() dto: CerrarDenunciaDto,
  ) {
    return this.cierresService.cerrar(user.userId, denunciaId, dto);
  }
}
