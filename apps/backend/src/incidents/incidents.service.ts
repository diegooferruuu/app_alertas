import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Incident } from './entities/incident.entity';
import { CreateIncidentDto } from './dto/create-incident.dto';
import { UpdateIncidentDto } from './dto/update-incident.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class IncidentsService {
  constructor(
    @InjectRepository(Incident)
    private incidentsRepository: Repository<Incident>,
    private usersService: UsersService,
  ) {}

  /**
   * Crea un incidente. Solo usuarios con identidad verificada (Ciudadanos)
   * pueden reportar; los Visitantes reciben 403.
   */
  async create(userId: string, dto: CreateIncidentDto): Promise<Incident> {
    const user = await this.usersService.findById(userId);

    if (!user.identity_verified) {
      throw new ForbiddenException(
        'Debes verificar tu identidad para reportar incidentes',
      );
    }
    if (user.is_suspended) {
      throw new ForbiddenException('Tu cuenta está suspendida');
    }

    const incident = this.incidentsRepository.create({
      reporter_id: userId,
      category: dto.category as Incident['category'],
      victim_name: dto.victim_name,
      description: dto.description,
      latitude: dto.latitude,
      longitude: dto.longitude,
      photo_base64: dto.photo_base64 ?? null,
      status: 'activo',
    });

    return this.incidentsRepository.save(incident);
  }

  /** Denuncias creadas por un usuario (sección "Mis denuncias"). */
  async findMine(userId: string): Promise<Incident[]> {
    return this.incidentsRepository.find({
      where: { reporter_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /** Edita una denuncia; solo el autor puede hacerlo. */
  async update(
    userId: string,
    id: string,
    dto: UpdateIncidentDto,
  ): Promise<Incident> {
    const incident = await this.findOne(id);
    if (incident.reporter_id !== userId) {
      throw new ForbiddenException('Solo puedes editar tus propias denuncias');
    }

    if (dto.victim_name !== undefined) incident.victim_name = dto.victim_name;
    if (dto.description !== undefined) incident.description = dto.description;
    if (dto.photo_base64 !== undefined) incident.photo_base64 = dto.photo_base64;

    return this.incidentsRepository.save(incident);
  }

  /** Borra una denuncia; solo el autor puede hacerlo. */
  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const incident = await this.findOne(id);
    if (incident.reporter_id !== userId) {
      throw new ForbiddenException('Solo puedes borrar tus propias denuncias');
    }
    await this.incidentsRepository.remove(incident);
    return { deleted: true };
  }

  /**
   * Incidentes dentro de un radio (metros) de un punto, ordenados por cercanía.
   * Usa PostGIS ST_DWithin sobre un cast a geography (no requiere columna extra).
   */
  async findNearby(
    lat: number,
    lng: number,
    radiusMeters = 5000,
    limit = 100,
  ): Promise<Array<Incident & { distance_meters: number }>> {
    const rows = await this.incidentsRepository
      .createQueryBuilder('incident')
      .addSelect(
        `ST_Distance(
          ST_SetSRID(ST_MakePoint(incident.longitude, incident.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography
        )`,
        'distance_meters',
      )
      .where(
        `ST_DWithin(
          ST_SetSRID(ST_MakePoint(incident.longitude, incident.latitude), 4326)::geography,
          ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography,
          :radius
        )`,
      )
      .andWhere('incident.status != :descartado', { descartado: 'descartado' })
      .setParameters({ lat, lng, radius: radiusMeters })
      .orderBy('distance_meters', 'ASC')
      .limit(limit)
      .getRawAndEntities();

    // Combina la entidad con la distancia calculada
    return rows.entities.map((incident, i) => ({
      ...incident,
      distance_meters: Math.round(Number(rows.raw[i].distance_meters)),
    })) as Array<Incident & { distance_meters: number }>;
  }

  /** Lista los incidentes más recientes (para la pestaña de lista). */
  async findRecent(limit = 50): Promise<Incident[]> {
    return this.incidentsRepository.find({
      where: {},
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string): Promise<Incident> {
    const incident = await this.incidentsRepository.findOne({ where: { id } });
    if (!incident) {
      throw new NotFoundException('Incidente no encontrado');
    }
    return incident;
  }
}
