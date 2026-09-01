import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Denuncia } from './entities/denuncia.entity';
import { CreateDenunciaDto } from './dto/create-denuncia.dto';
import { UpdateDenunciaDto } from './dto/update-denuncia.dto';
import { UsersService } from '../users/users.service';

@Injectable()
export class DenunciasService {
  constructor(
    @InjectRepository(Denuncia)
    private denunciasRepository: Repository<Denuncia>,
    private usersService: UsersService,
  ) {}

  /**
   * Crea una denuncia. Solo quien tiene documento registrado puede denunciar,
   * porque la denuncia queda atribuida a ese documento.
   */
  async create(userId: string, dto: CreateDenunciaDto): Promise<Denuncia> {
    const user = await this.usersService.findById(userId);

    if (!user.documento_registrado) {
      throw new ForbiddenException(
        'Debes registrar tu documento de identidad para reportar',
      );
    }
    if (user.is_suspended) {
      throw new ForbiddenException('Tu cuenta está suspendida');
    }

    const denuncia = this.denunciasRepository.create({
      denunciante_id: userId,
      nombre_persona_buscada: dto.nombre_persona_buscada,
      description: dto.description,
      latitude: dto.latitude,
      longitude: dto.longitude,
      photo_base64: dto.photo_base64 ?? null,
      status: 'activo',
    });

    return this.denunciasRepository.save(denuncia);
  }

  /** Denuncias creadas por un usuario (sección «Mis denuncias»). */
  async findMine(userId: string): Promise<Denuncia[]> {
    return this.denunciasRepository.find({
      where: { denunciante_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /** Edita una denuncia; solo su autor puede hacerlo. */
  async update(
    userId: string,
    id: string,
    dto: UpdateDenunciaDto,
  ): Promise<Denuncia> {
    const denuncia = await this.findOne(id);
    if (denuncia.denunciante_id !== userId) {
      throw new ForbiddenException('Solo puedes editar tus propias denuncias');
    }

    if (dto.nombre_persona_buscada !== undefined) {
      denuncia.nombre_persona_buscada = dto.nombre_persona_buscada;
    }
    if (dto.description !== undefined) denuncia.description = dto.description;
    if (dto.photo_base64 !== undefined) denuncia.photo_base64 = dto.photo_base64;

    return this.denunciasRepository.save(denuncia);
  }

  /** Borra una denuncia; solo su autor puede hacerlo. */
  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const denuncia = await this.findOne(id);
    if (denuncia.denunciante_id !== userId) {
      throw new ForbiddenException('Solo puedes borrar tus propias denuncias');
    }
    await this.denunciasRepository.remove(denuncia);
    return { deleted: true };
  }

  /**
   * Denuncias dentro de un radio (metros) de un punto, ordenadas por cercanía.
   *
   * Opera sobre la columna generada `ubicacion`, que tiene índice GiST. Comparar
   * contra un cast por fila impediría usarlo y recorrería la tabla entera.
   */
  async findNearby(
    lat: number,
    lng: number,
    radiusMeters = 5000,
    limit = 100,
  ): Promise<Array<Denuncia & { distance_meters: number }>> {
    const punto = `ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography`;

    const rows = await this.denunciasRepository
      .createQueryBuilder('denuncia')
      .addSelect(`ST_Distance(denuncia.ubicacion, ${punto})`, 'distance_meters')
      .where(`ST_DWithin(denuncia.ubicacion, ${punto}, :radius)`)
      .andWhere('denuncia.status != :descartado', { descartado: 'descartado' })
      .setParameters({ lat, lng, radius: radiusMeters })
      .orderBy('distance_meters', 'ASC')
      .limit(limit)
      .getRawAndEntities();

    return rows.entities.map((denuncia, i) => ({
      ...denuncia,
      distance_meters: Math.round(Number(rows.raw[i].distance_meters)),
    })) as Array<Denuncia & { distance_meters: number }>;
  }

  /** Lista las denuncias más recientes. */
  async findRecent(limit = 50): Promise<Denuncia[]> {
    return this.denunciasRepository.find({
      order: { created_at: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string): Promise<Denuncia> {
    const denuncia = await this.denunciasRepository.findOne({ where: { id } });
    if (!denuncia) {
      throw new NotFoundException('Denuncia no encontrada');
    }
    return denuncia;
  }
}
