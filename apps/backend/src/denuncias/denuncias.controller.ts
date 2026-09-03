import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { DenunciasService } from './denuncias.service';
import { CreateDenunciaDto } from './dto/create-denuncia.dto';
import { UpdateDenunciaDto } from './dto/update-denuncia.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { vistaPublica, vistaPublicaDe } from './vista-publica';

@Controller('denuncias')
@UseGuards(JwtAuthGuard)
export class DenunciasController {
  constructor(private readonly denunciasService: DenunciasService) {}

  // Toda respuesta pasa por `vistaPublica`: es el único punto donde se decide
  // qué sale de aquí, y quita el identificador de quien denunció (I8).
  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateDenunciaDto) {
    const denuncia = await this.denunciasService.create(user.userId, dto);
    return vistaPublica(denuncia, user.userId);
  }

  // Denuncias cercanas, para pintar el mapa
  @Get('cercanas')
  async findNearby(
    @CurrentUser() user: any,
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('radius') radius?: string,
  ) {
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      throw new BadRequestException('lat y lng son requeridos y deben ser números');
    }
    const radiusMeters = radius ? Number(radius) : 5000;
    const denuncias = await this.denunciasService.findNearby(
      latitude,
      longitude,
      radiusMeters,
    );
    return vistaPublicaDe(denuncias, user.userId);
  }

  // Denuncias del usuario autenticado (debe ir antes de ':id')
  @Get('mias')
  async findMine(@CurrentUser() user: any) {
    const denuncias = await this.denunciasService.findMine(user.userId);
    return vistaPublicaDe(denuncias, user.userId);
  }

  @Get()
  async findRecent(@CurrentUser() user: any) {
    const denuncias = await this.denunciasService.findRecent();
    return vistaPublicaDe(denuncias, user.userId);
  }

  /**
   * Detalle de una denuncia, con sus fotografías.
   *
   * Es el único punto que devuelve el contenido de las imágenes: las consultas
   * de listado y de cercanía no lo traen, para no arrastrar cientos de
   * kilobytes por fila en la ruta crítica del sistema.
   */
  @Get(':id')
  async findOne(@CurrentUser() user: any, @Param('id') id: string) {
    const denuncia = await this.denunciasService.findOne(id);
    const fotografias = await this.denunciasService.fotografiasDe(id);
    return { ...vistaPublica(denuncia, user.userId), fotografias };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDenunciaDto,
  ) {
    const denuncia = await this.denunciasService.update(user.userId, id, dto);
    return vistaPublica(denuncia, user.userId);
  }

  // No hay DELETE, y no es un olvido: el invariante I7 dice que ningún rol
  // puede eliminar una denuncia. Una alerta deja de difundirse por caducidad o
  // por desactivación de la persona reportada, nunca borrando la fila.
}
