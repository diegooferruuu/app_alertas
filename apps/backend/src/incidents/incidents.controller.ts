import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseFloatPipe,
  BadRequestException,
} from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser() user: any,
    @Body() dto: CreateIncidentDto,
  ) {
    return this.incidentsService.create(user.userId, dto);
  }

  // Incidentes cercanos para pintar el mapa
  @Get('nearby')
  @UseGuards(JwtAuthGuard)
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

  // Lista de incidentes recientes (pestaña de lista)
  @Get()
  @UseGuards(JwtAuthGuard)
  async findRecent() {
    return this.incidentsService.findRecent();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string) {
    return this.incidentsService.findOne(id);
  }
}
