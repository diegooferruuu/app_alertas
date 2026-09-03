import {
  Controller,
  Post,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { ConstanciasService } from './constancias.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * Constancia probatoria (§6).
 *
 * Es un acto **separado y deliberado**, posterior al retiro de la alerta y nunca
 * automático. La mayoría de las personas solo quiere que la alerta se detenga;
 * volcarles encima la identidad de quien las denunció obligaría a todas a entrar
 * en modo confrontación, incluida la que solo estaba corrigiendo un malentendido.
 */
@Controller('constancias')
@UseGuards(JwtAuthGuard)
export class ConstanciasController {
  constructor(private readonly constanciasService: ConstanciasService) {}

  /**
   * Solicita la constancia de una denuncia.
   *
   * Es POST y no GET porque **no es una lectura**: cada entrega de identidad
   * queda registrada. El rastro de auditoría es parte del diseño, no un efecto
   * colateral.
   *
   * No recibe justificación alguna, y es deliberado: no hay ante quién
   * justificarse y pedirla sería un trámite decorativo.
   */
  @Post('denuncias/:denunciaId')
  async solicitar(
    @CurrentUser() user: any,
    @Param('denunciaId', ParseUUIDPipe) denunciaId: string,
  ) {
    return this.constanciasService.solicitar(user.userId, denunciaId);
  }
}
