import { Controller, Get, UseGuards } from '@nestjs/common';
import { SancionesService } from './sanciones.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('usuarios')
@UseGuards(JwtAuthGuard)
export class SancionesController {
  constructor(private readonly sancionesService: SancionesService) {}

  /** La situación propia. No hay ruta para consultar la de otra persona. */
  @Get('me/sanciones')
  async misSanciones(@CurrentUser() user: any) {
    return this.sancionesService.situacionDe(user.userId);
  }
}
