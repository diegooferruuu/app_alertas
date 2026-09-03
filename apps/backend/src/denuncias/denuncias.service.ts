import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { createHash } from 'crypto';
import { Denuncia } from './entities/denuncia.entity';
import { FotografiaDenuncia } from './entities/fotografia-denuncia.entity';
import { CreateDenunciaDto } from './dto/create-denuncia.dto';
import { UpdateDenunciaDto } from './dto/update-denuncia.dto';
import {
  EstadoDenuncia,
  NivelConfianza,
  puedeTransicionarEstado,
  puedeTransicionarNivel,
} from './domain/estados';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { AlertasService } from '../alertas/alertas.service';

@Injectable()
export class DenunciasService {
  constructor(
    @InjectRepository(Denuncia)
    private denunciasRepository: Repository<Denuncia>,
    @InjectRepository(FotografiaDenuncia)
    private fotografiasRepository: Repository<FotografiaDenuncia>,
    private usersService: UsersService,
    private dataSource: DataSource,
    private alertasService: AlertasService,
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

    const ciHashPersonaBuscada = this.hashDeCi(dto.ci_persona_buscada);

    const guardada = await this.dataSource.transaction(async (manager) => {
      const denuncias = manager.getRepository(Denuncia);

      const denuncia = await denuncias.save(
        denuncias.create({
          denunciante_id: userId,
          nombre_persona_buscada: dto.nombre_persona_buscada,
          ci_hash_persona_buscada: ciHashPersonaBuscada,
          description: dto.description,
          latitude: dto.latitude,
          longitude: dto.longitude,
          nivel_confianza: NivelConfianza.REGISTRADA,
          estado: EstadoDenuncia.ACTIVA,
          // Sin radio ni caducidad: todavía no se difunde nada.
          radio_actual_m: null,
          expira_en: null,
        }),
      );

      if (dto.fotografia_base64) {
        await this.reemplazarFotografia(
          dto.fotografia_base64,
          denuncia.id,
          manager,
        );
      }

      // ---------------------------------------------------------------------
      // Aviso a la persona reportada, si tiene cuenta.
      //
      // Se hace aquí, al crear, y no al difundir: quien es reportado tiene
      // derecho a enterarse antes de que nada salga a la zona, no después.
      //
      // Nada de lo que ocurra en este bloque puede observarse desde fuera
      // (invariante I5). El resultado devuelto es idéntico haya coincidencia o
      // no: si el denunciante pudiera deducir que la persona tiene cuenta,
      // habría convertido el sistema en un buscador de documentos.
      // ---------------------------------------------------------------------
      const reportado = await manager.getRepository(User).findOne({
        where: { ci_hash: ciHashPersonaBuscada },
        select: { id: true },
      });

      if (reportado) {
        await this.alertasService.encolarAvisoDirecto(
          manager,
          denuncia.id,
          reportado.id,
        );
      }

      return denuncia;
    });

    // `save()` rellena la columna generada con su representación binaria pese a
    // estar marcada `select: false`. No es información nueva —se deriva de las
    // coordenadas, que ya viajan— pero es ruido en cada respuesta y contradice
    // la intención de la entidad.
    delete (guardada as Partial<Denuncia>).ubicacion;

    return guardada;
  }

  /**
   * Deja una sola fotografía por denuncia.
   *
   * La tabla admite varias —una desaparición suele tener más de una imagen—,
   * pero el formulario actual envía una. Reemplazar en lugar de acumular evita
   * que editar dos veces deje fotos huérfanas de versiones anteriores.
   */
  private async reemplazarFotografia(
    contenido: string,
    denunciaId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(FotografiaDenuncia)
      : this.fotografiasRepository;

    await repo.delete({ denuncia_id: denunciaId });
    await repo.save(repo.create({ denuncia_id: denunciaId, contenido }));
  }

  /**
   * Fotografías de una denuncia, con su contenido.
   *
   * El contenido está marcado `select: false`, así que hay que pedirlo de forma
   * explícita: es justamente lo que impide que se cuele en otras consultas.
   */
  async fotografiasDe(denunciaId: string): Promise<FotografiaDenuncia[]> {
    return this.fotografiasRepository
      .createQueryBuilder('foto')
      .addSelect('foto.contenido')
      .where('foto.denuncia_id = :denunciaId', { denunciaId })
      .orderBy('foto.creada_en', 'ASC')
      .getMany();
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

  /**
   * Marca como CADUCADAS las denuncias cuya alerta venció.
   *
   * Muere la alerta, no el caso: no se borra nada y el autor la sigue viendo,
   * como cuando estaba en nivel REGISTRADA. Se conservan `radio_actual_m` y
   * `expira_en` porque son el registro de hasta dónde y hasta cuándo se
   * difundió, dato que la validación del sistema necesita.
   *
   * Es un solo UPDATE y no un cargar-modificar-guardar por fila: la cantidad de
   * vencidas en un tick puede ser grande y no hay nada que decidir por caso.
   *
   * Devuelve cuántas caducaron, para que quien lo invoque pueda registrarlo.
   */
  async caducarVencidas(): Promise<number> {
    const resultado = await this.denunciasRepository
      .createQueryBuilder()
      .update(Denuncia)
      .set({ estado: EstadoDenuncia.CADUCADA })
      .where('estado = :activa', { activa: EstadoDenuncia.ACTIVA })
      .andWhere('nivel_confianza != :registrada', {
        registrada: NivelConfianza.REGISTRADA,
      })
      .andWhere('expira_en IS NOT NULL')
      .andWhere('expira_en <= now()')
      .execute();

    return resultado.affected ?? 0;
  }

  /**
   * Denuncias creadas por un usuario (sección «Mis denuncias»).
   *
   * Sin filtrar por estado a propósito: su autor sigue viendo las caducadas y
   * las invalidadas. Caducar retira la alerta, no el caso.
   */
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

    const actualizada = await this.denunciasRepository.save(denuncia);

    if (dto.fotografia_base64 !== undefined) {
      await this.reemplazarFotografia(dto.fotografia_base64, id);
    }

    return actualizada;
  }

  /**
   * No existe forma de eliminar una denuncia, y es deliberado (invariante I7).
   *
   * Una denuncia queda atribuida a la identidad de quien la firmó: poder
   * borrarla permitiría reportar a alguien, difundir la alerta y hacer
   * desaparecer el rastro. Lo que sí ocurre —solo por mecanismos automáticos—
   * es que la alerta deje de difundirse: por caducidad o por desactivación de
   * la persona reportada. La información no se borra nunca.
   *
   * Si en el futuro hiciera falta retirar contenido, la vía correcta es una
   * transición de estado, no un DELETE.
   */

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
