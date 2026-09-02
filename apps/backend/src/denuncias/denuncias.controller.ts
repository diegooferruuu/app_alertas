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

@Controller('denuncias')
@UseGuards(JwtAuthGuard)
export class DenunciasController {
  constructor(private readonly denunciasService: DenunciasService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateDenunciaDto) {
    return this.denunciasService.create(user.userId, dto);
  }

  // Denuncias cercanas, para pintar el mapa
  @Get('cercanas')
  async findNearby(
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
    return this.denunciasService.findNearby(latitude, longitude, radiusMeters);
  }

  // Denuncias del usuario autenticado (debe ir antes de ':id')
  @Get('mias')
  async findMine(@CurrentUser() user: any) {
    return this.denunciasService.findMine(user.userId);
  }

  @Get()
  async findRecent() {
    return this.denunciasService.findRecent();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.denunciasService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateDenunciaDto,
  ) {
    return this.denunciasService.update(user.userId, id, dto);
  }

  // No hay DELETE, y no es un olvido: el invariante I7 dice que ningún rol
  // puede eliminar una denuncia. Una alerta deja de difundirse por caducidad o
  // por desactivación de la persona reportada, nunca borrando la fila.
}
