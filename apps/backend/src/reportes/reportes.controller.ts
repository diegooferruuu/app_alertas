import { Body, Controller, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ReportesService } from './reportes.service';
import { ReportarContenidoDto } from './dto/reportar-contenido.dto';

@Controller('denuncias')
@UseGuards(JwtAuthGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /** «Reportar contenido», desde el detalle de una alerta que no es tuya. */
  @Post(':id/reportes')
  @HttpCode(200)
  async reportar(
    @CurrentUser() user: any,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportarContenidoDto
  ) {
    return this.reportesService.reportar(user.userId, id, dto);
  }
}
