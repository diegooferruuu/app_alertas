import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { DispositivosService } from './dispositivos.service';
import { UbicacionService } from './ubicacion.service';
import { RegistrarDispositivoDto } from './dto/registrar-dispositivo.dto';
import { ActualizarUbicacionDto } from './dto/actualizar-ubicacion.dto';
import { Plataforma } from './entities/dispositivo.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('alertas')
@UseGuards(JwtAuthGuard)
export class AlertasController {
  constructor(
    private readonly dispositivosService: DispositivosService,
    private readonly ubicacionService: UbicacionService,
  ) {}

  /** Registra el dispositivo donde esta persona recibirá alertas. */
  @Post('dispositivos')
  async registrarDispositivo(
    @CurrentUser() user: any,
    @Body() dto: RegistrarDispositivoDto,
  ) {
    const dispositivo = await this.dispositivosService.registrar(
      user.userId,
      dto.push_token,
      dto.plataforma as Plataforma,
    );
    return { id: dispositivo.id, plataforma: dispositivo.plataforma };
  }

  @Get('dispositivos')
  async misDispositivos(@CurrentUser() user: any) {
    const dispositivos = await this.dispositivosService.deUsuario(user.userId);
    // El token no se devuelve: identifica al aparato y no aporta nada en la app.
    return dispositivos.map((d) => ({
      id: d.id,
      plataforma: d.plataforma,
      ultima_actividad: d.ultima_actividad,
    }));
  }

  @Put('ubicacion')
  async actualizarUbicacion(
    @CurrentUser() user: any,
    @Body() dto: ActualizarUbicacionDto,
  ) {
    await this.ubicacionService.actualizar(user.userId, dto.latitude, dto.longitude);
    return { actualizada: true };
  }
}
