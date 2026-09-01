import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('incidents')
@UseGuards(JwtAuthGuard)
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateIncidentDto) {
    return this.incidentsService.create(user.userId, dto);
  }

  // Incidentes cercanos para pintar el mapa
  @Get('nearby')
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
    return this.incidentsService.findNearby(latitude, longitude, radiusMeters);
  }

  // Denuncias del usuario autenticado (debe ir antes de ':id')
  @Get('mine')
  async findMine(@CurrentUser() user: any) {
    return this.incidentsService.findMine(user.userId);
  }

  // Lista de incidentes recientes
  @Get()
  async findRecent() {
    return this.incidentsService.findRecent();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateIncidentDto,
  ) {
    return this.incidentsService.update(user.userId, id, dto);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.incidentsService.remove(user.userId, id);
  }
}
