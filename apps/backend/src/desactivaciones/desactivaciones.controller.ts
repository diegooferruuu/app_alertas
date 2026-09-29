import {
  Controller,
  Get,
  Post,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { DesactivacionesService } from './desactivaciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * El interruptor de desactivación.
 *
 * Ambas rutas operan siempre sobre quien está autenticado: no reciben a quién
 * afectan, lo deducen del documento registrado en la sesión. No hay forma de
 * pedir «desactiva la denuncia de otro» porque no hay parámetro donde decirlo.
 */
@Controller('desactivaciones')
@UseGuards(JwtAuthGuard)
export class DesactivacionesController {
  constructor(
    private readonly desactivacionesService: DesactivacionesService,
  ) {}

  /** Las denuncias vivas que identifican a quien consulta. Nunca las de otro. */
  @Get('denuncias')
  async misDenunciasIdentificadoras(@CurrentUser() user: any) {
    return this.desactivacionesService.denunciasQueMeIdentifican(user.userId);
  }

  /**
   * Retira una alerta que identifica a quien la ejecuta.
   *
   * Es POST y no DELETE: no se borra nada. La denuncia queda registrada y
   * verificable —invariante I7—, lo que se detiene es su difusión.
   */
  @Post(':denunciaId')
  async desactivar(
    @CurrentUser() user: any,
    @Param('denunciaId', ParseUUIDPipe) denunciaId: string,
  ) {
    return this.desactivacionesService.desactivar(user.userId, denunciaId);
  }
}
