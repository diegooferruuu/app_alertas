import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Denuncia } from './entities/denuncia.entity';
import { CreateDenunciaDto } from './dto/create-denuncia.dto';
import { UpdateDenunciaDto } from './dto/update-denuncia.dto';
import {
  EstadoDenuncia,
  NivelConfianza,
  puedeTransicionarEstado,
  puedeTransicionarNivel,
} from './domain/estados';
import { UsersService } from '../users/users.service';

@Injectable()
export class DenunciasService {
  constructor(
    @InjectRepository(Denuncia)
    private denunciasRepository: Repository<Denuncia>,
    private usersService: UsersService,
  ) {}

  /** El número de documento nunca se almacena en claro, solo su hash. */
  private hashDeCi(ciNumber: string): string {
    return createHash('sha256').update(ciNumber.trim()).digest('hex');
  }

  /**
   * Crea una denuncia en nivel REGISTRADA: existe, pero no se difunde nada.
   *
   * La difusión requiere firmar la declaración jurada (fase 2). Esto es el
   * invariante I1: crear una denuncia y emitir una alerta son operaciones
   * distintas.
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
      ci_hash_persona_buscada: this.hashDeCi(dto.ci_persona_buscada),
      description: dto.description,
      latitude: dto.latitude,
      longitude: dto.longitude,
      photo_base64: dto.photo_base64 ?? null,
      nivel_confianza: NivelConfianza.REGISTRADA,
      estado: EstadoDenuncia.ACTIVA,
      // Sin radio ni caducidad: todavía no se difunde nada.
      radio_actual_m: null,
      expira_en: null,
    });

    return this.denunciasRepository.save(denuncia);
  }

  /**
   * Cambia el nivel de confianza validando la transición.
   *
   * Único punto por el que el nivel puede subir: concentrarlo aquí es lo que
   * impide que un camino nuevo difunda una denuncia sin pasar por las reglas.
   */
  async transicionarNivel(
    id: string,
    hacia: NivelConfianza,
    cambios: Partial<Pick<Denuncia, 'radio_actual_m' | 'expira_en'>> = {},
  ): Promise<Denuncia> {
    const denuncia = await this.findOne(id);

    if (denuncia.estado !== EstadoDenuncia.ACTIVA) {
      throw new ConflictException(
        `Una denuncia ${denuncia.estado} no puede cambiar de nivel de confianza`,
      );
    }
    if (!puedeTransicionarNivel(denuncia.nivel_confianza, hacia)) {
      throw new ConflictException(
        `Transición de nivel inválida: ${denuncia.nivel_confianza} → ${hacia}`,
      );
    }

    denuncia.nivel_confianza = hacia;
    if (cambios.radio_actual_m !== undefined) {
      denuncia.radio_actual_m = cambios.radio_actual_m;
    }
    if (cambios.expira_en !== undefined) {
      denuncia.expira_en = cambios.expira_en;
    }

    return this.denunciasRepository.save(denuncia);
  }

  /** Cambia el estado validando la transición. */
  async transicionarEstado(
    id: string,
    hacia: EstadoDenuncia,
  ): Promise<Denuncia> {
    const denuncia = await this.findOne(id);

    if (!puedeTransicionarEstado(denuncia.estado, hacia)) {
      throw new ConflictException(
        `Transición de estado inválida: ${denuncia.estado} → ${hacia}`,
      );
    }

    denuncia.estado = hacia;
    return this.denunciasRepository.save(denuncia);
  }

  /** Denuncias creadas por un usuario (sección «Mis denuncias»). */
  async findMine(userId: string): Promise<Denuncia[]> {
    return this.denunciasRepository.find({
      where: { denunciante_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Edita una denuncia; solo su autor y solo mientras esté REGISTRADA.
   *
   * Una vez firmada la declaración jurada, el contenido queda sellado por su
   * hash: modificarlo rompería la cadena probatoria.
   */
  async update(
    userId: string,
    id: string,
    dto: UpdateDenunciaDto,
  ): Promise<Denuncia> {
    const denuncia = await this.findOne(id);
    if (denuncia.denunciante_id !== userId) {
      throw new ForbiddenException('Solo puedes editar tus propias denuncias');
    }
    if (denuncia.nivel_confianza !== NivelConfianza.REGISTRADA) {
      throw new ConflictException(
        'Esta denuncia ya fue declarada bajo juramento y su contenido no puede modificarse',
      );
    }

    if (dto.nombre_persona_buscada !== undefined) {
      denuncia.nombre_persona_buscada = dto.nombre_persona_buscada;
    }
    if (dto.description !== undefined) denuncia.description = dto.description;
    if (dto.photo_base64 !== undefined) denuncia.photo_base64 = dto.photo_base64;

    return this.denunciasRepository.save(denuncia);
  }

  /**
   * Borra una denuncia; solo su autor puede hacerlo.
   *
   * TODO(H1.5): esta ruta contradice el invariante I7 —ningún rol puede
   * eliminar una denuncia— y debe desaparecer junto con los botones del cliente
   * móvil, en un mismo incremento para no romper la app.
   */
  async remove(userId: string, id: string): Promise<{ deleted: boolean }> {
    const denuncia = await this.findOne(id);
    if (denuncia.denunciante_id !== userId) {
      throw new ForbiddenException('Solo puedes borrar tus propias denuncias');
    }
    await this.denunciasRepository.remove(denuncia);
    return { deleted: true };
  }

  /**
   * Denuncias que se difunden y alcanzan un punto dado.
   *
   * Tres filtros que no son opcionales: la denuncia debe estar activa, haber
   * superado el nivel REGISTRADA, y no haber vencido. Este último filtro por
   * `expira_en` garantiza corrección aunque el trabajo programado de caducidad
   * no llegue a correr.
   *
   * Opera sobre la columna generada `ubicacion`, que tiene índice GiST.
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
      .andWhere('denuncia.estado = :activa', { activa: EstadoDenuncia.ACTIVA })
      .andWhere('denuncia.nivel_confianza != :registrada', {
        registrada: NivelConfianza.REGISTRADA,
      })
      .andWhere('denuncia.expira_en > now()')
      .setParameters({ lat, lng, radius: radiusMeters })
      .orderBy('distance_meters', 'ASC')
      .limit(limit)
      .getRawAndEntities();

    return rows.entities.map((denuncia, i) => ({
      ...denuncia,
      distance_meters: Math.round(Number(rows.raw[i].distance_meters)),
    })) as Array<Denuncia & { distance_meters: number }>;
  }

  /** Denuncias difundidas más recientes. Mismos filtros que la consulta por cercanía. */
  async findRecent(limit = 50): Promise<Denuncia[]> {
    return this.denunciasRepository
      .createQueryBuilder('denuncia')
      .where('denuncia.estado = :activa', { activa: EstadoDenuncia.ACTIVA })
      .andWhere('denuncia.nivel_confianza != :registrada', {
        registrada: NivelConfianza.REGISTRADA,
      })
      .andWhere('denuncia.expira_en > now()')
      .orderBy('denuncia.created_at', 'DESC')
      .limit(limit)
      .getMany();
  }

  async findOne(id: string): Promise<Denuncia> {
    const denuncia = await this.denunciasRepository.findOne({ where: { id } });
    if (!denuncia) {
      throw new NotFoundException('Denuncia no encontrada');
    }
    return denuncia;
  }
}
