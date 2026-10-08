import {
  Injectable,
  BadRequestException,
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
import { normalizarMultiple } from './domain/descripcion-fisica';
import { aZonaDeAvistamiento } from './domain/zona-avistamiento';
import { esMenorDeEdad, MOTIVO_SIN_FOTOGRAFIA } from './domain/minoria-edad';
import { VERSION_FORMULA_ACTUAL } from '../declaraciones/domain/cadena';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { AlertasService } from '../alertas/alertas.service';
import { revocarEmisionesPendientes } from '../alertas/revocacion';
import { SancionesService } from '../sanciones/sanciones.service';

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
    private sancionesService: SancionesService,
  ) {}

  /** El número de documento nunca se almacena en claro, solo su hash. */
  private hashDeCi(ciNumber: string): string {
    return createHash('sha256').update(ciNumber.trim()).digest('hex');
  }

  /**
   * Nadie fue visto por última vez en el futuro (§7).
   *
   * Se comprueba aquí y no con una restricción de la base porque `now()` no es
   * inmutable y Postgres no la admite dentro de un CHECK. La otra regla temporal
   * —nacer antes de haber sido visto— sí vive en la base, donde una escritura
   * directa tampoco puede saltársela.
   */
  private rechazarAvistamientoFuturo(instante: string): void {
    if (new Date(instante).getTime() > Date.now()) {
      throw new BadRequestException(
        'El último avistamiento no puede ser una fecha futura',
      );
    }
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
    const ciHashPersonaBuscada = this.hashDeCi(dto.ci_persona_buscada);

    // El régimen de sanciones muerde aquí: una cuenta suspendida no denuncia, ni
    // nadie puede denunciar a una persona que le bloqueó hacerlo, ni tener dos
    // denuncias abiertas sobre la misma. Ninguna de las tres revela nada que el
    // denunciante no sepa (I5): todas miran su propio historial.
    await this.sancionesService.verificarPuedeDenunciar(user, ciHashPersonaBuscada);

    this.rechazarAvistamientoFuturo(dto.ultimo_avistamiento_en);

    // Un menor no lleva fotografía; cualquier otra persona sí, y ahora que el
    // DTO la acepta ausente hay que exigirla aquí. Sin esta línea, omitir el
    // campo sería la forma de crear denuncias sin retrato.
    const fotografia = this.fotografiaPermitida(
      dto.fecha_nacimiento,
      dto.fotografia_base64,
    );
    if (fotografia === undefined && !esMenorDeEdad(dto.fecha_nacimiento)) {
      throw new BadRequestException(
        'La fotografía es obligatoria: sin imagen la alerta no sirve para reconocer',
      );
    }

    // La ubicación exacta del avistamiento no debe existir en la base: se
    // reduce a la zona de ~1 km que la contiene antes de escribir nada. El
    // punto preciso se descarta aquí y no viaja más allá de esta línea.
    const zona = aZonaDeAvistamiento({
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    const guardada = await this.dataSource.transaction(async (manager) => {
      const denuncias = manager.getRepository(Denuncia);

      const denuncia = await denuncias.save(
        denuncias.create({
          denunciante_id: userId,
          nombre_persona_buscada: dto.nombre_persona_buscada,
          ci_hash_persona_buscada: ciHashPersonaBuscada,
          // El relato libre se retiró del formulario; una denuncia nueva no lo
          // tiene, y por eso se sella con la fórmula que no lo incluye.
          description: null,
          version_formula_contenido: VERSION_FORMULA_ACTUAL,
          fecha_nacimiento: dto.fecha_nacimiento,
          sexo: dto.sexo,
          estatura_rango: dto.estatura_rango,
          contextura: dto.contextura,
          color_piel: dto.color_piel,
          color_cabello: dto.color_cabello,
          color_ojos: dto.color_ojos,
          senas_particulares: normalizarMultiple(dto.senas_particulares),
          ultimo_avistamiento_en: new Date(dto.ultimo_avistamiento_en),
          prenda_superior: dto.prenda_superior,
          color_prenda_superior: dto.color_prenda_superior,
          prenda_inferior: dto.prenda_inferior,
          color_prenda_inferior: dto.color_prenda_inferior,
          calzado: dto.calzado ?? null,
          circunstancia: dto.circunstancia,
          condicion_relevante: normalizarMultiple(dto.condicion_relevante),
          latitude: zona.latitude,
          longitude: zona.longitude,
          nivel_confianza: NivelConfianza.REGISTRADA,
          estado: EstadoDenuncia.ACTIVA,
          // Sin radio ni caducidad: todavía no se difunde nada.
          radio_actual_m: null,
          expira_en: null,
        }),
      );

      if (fotografia !== undefined) {
        await this.reemplazarFotografia(fotografia, denuncia.id, manager);
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
    }).catch((error) => {
      // Dos peticiones simultáneas pasan las dos la comprobación previa; la que
      // llega segunda choca con el índice único y recibe el mismo mensaje.
      if (error?.driverError?.constraint === 'uq_denuncias_abierta_por_persona') {
        throw this.sancionesService.denunciaAbierta();
      }
      throw error;
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
  /**
   * Decide si una denuncia puede llevar fotografía, y lo impone.
   *
   * Está en el servidor y no solo en la aplicación porque la aplicación corre en
   * un teléfono ajeno: una versión modificada puede mandar el campo igual. Si la
   * regla viviera solo en la pantalla, sería una sugerencia.
   *
   * Devuelve la fotografía que corresponde guardar: la recibida, o `undefined`
   * si no hay que tocar ninguna.
   */
  private fotografiaPermitida(
    fechaNacimiento: string | Date | null | undefined,
    recibida: string | undefined,
  ): string | undefined {
    if (!esMenorDeEdad(fechaNacimiento)) {
      return recibida;
    }

    // Mandar la foto de un menor no se ignora en silencio: quien la envió tiene
    // que enterarse de que no se guardó, o creerá que la alerta lleva retrato.
    if (recibida !== undefined) {
      throw new BadRequestException(MOTIVO_SIN_FOTOGRAFIA);
    }

    return undefined;
  }

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
    // Sin firmar no hay sellado, pero una cerrada tampoco se edita: cambiarla
    // después alteraría lo que la persona reportada vio cuando la cerró.
    if (denuncia.estado !== EstadoDenuncia.ACTIVA) {
      throw new ConflictException('Una denuncia cerrada ya no se puede editar');
    }

    if (dto.ultimo_avistamiento_en !== undefined) {
      this.rechazarAvistamientoFuturo(dto.ultimo_avistamiento_en);
    }

    // La regla del menor se evalúa contra la fecha **resultante**, no contra la
    // que venga en el cuerpo. Si no se evaluara así quedaría abierta la vía
    // obvia: crear la denuncia con fecha de adulto y fotografía, y corregir
    // después la fecha a la real. La foto ya estaría guardada.
    const nacimientoResultante =
      dto.fecha_nacimiento !== undefined
        ? dto.fecha_nacimiento
        : denuncia.fecha_nacimiento;

    const fotografia = this.fotografiaPermitida(
      nacimientoResultante,
      dto.fotografia_base64,
    );
    const pasaASerMenor = esMenorDeEdad(nacimientoResultante);

    // Se copia campo a campo y no con un `Object.assign` del DTO: el DTO trae
    // `fotografia_base64`, que no es una columna, y los campos de valor múltiple
    // necesitan normalizarse antes de guardarse.
    const asignar = <K extends keyof Denuncia>(campo: K, valor: Denuncia[K]) => {
      denuncia[campo] = valor;
    };

    if (dto.nombre_persona_buscada !== undefined) {
      asignar('nombre_persona_buscada', dto.nombre_persona_buscada);
    }
    if (dto.fecha_nacimiento !== undefined) {
      asignar('fecha_nacimiento', dto.fecha_nacimiento);
    }
    if (dto.sexo !== undefined) asignar('sexo', dto.sexo);
    if (dto.estatura_rango !== undefined) {
      asignar('estatura_rango', dto.estatura_rango);
    }
    if (dto.contextura !== undefined) asignar('contextura', dto.contextura);
    if (dto.color_piel !== undefined) asignar('color_piel', dto.color_piel);
    if (dto.color_cabello !== undefined) {
      asignar('color_cabello', dto.color_cabello);
    }
    if (dto.color_ojos !== undefined) asignar('color_ojos', dto.color_ojos);
    if (dto.senas_particulares !== undefined) {
      asignar('senas_particulares', normalizarMultiple(dto.senas_particulares));
    }
    if (dto.ultimo_avistamiento_en !== undefined) {
      asignar('ultimo_avistamiento_en', new Date(dto.ultimo_avistamiento_en));
    }
    if (dto.prenda_superior !== undefined) {
      asignar('prenda_superior', dto.prenda_superior);
    }
    if (dto.color_prenda_superior !== undefined) {
      asignar('color_prenda_superior', dto.color_prenda_superior);
    }
    if (dto.prenda_inferior !== undefined) {
      asignar('prenda_inferior', dto.prenda_inferior);
    }
    if (dto.color_prenda_inferior !== undefined) {
      asignar('color_prenda_inferior', dto.color_prenda_inferior);
    }
    if (dto.calzado !== undefined) asignar('calzado', dto.calzado);
    if (dto.circunstancia !== undefined) {
      asignar('circunstancia', dto.circunstancia);
    }
    if (dto.condicion_relevante !== undefined) {
      asignar(
        'condicion_relevante',
        normalizarMultiple(dto.condicion_relevante),
      );
    }

    const actualizada = await this.denunciasRepository.save(denuncia);

    if (pasaASerMenor) {
      // Corregir la fecha a la de un menor retira la fotografía que ya hubiera.
      // Es el único borrado de contenido del sistema y es deliberado: la
      // alternativa —conservarla y confiar en no exponerla— deja la imagen de un
      // niño en la base esperando el primer error de permisos.
      await this.fotografiasRepository.delete({ denuncia_id: id });
    } else if (fotografia !== undefined) {
      await this.reemplazarFotografia(fotografia, id);
    }

    return actualizada;
  }

  /**
   * No existe forma de eliminar una denuncia, y es deliberado (invariante I7).
   *
   * Una denuncia queda atribuida a la identidad de quien la firmó: poder
   * borrarla permitiría reportar a alguien, difundir la alerta y hacer
   * desaparecer el rastro. Lo que sí ocurre —solo por mecanismos automáticos—
   * es que la alerta deje de difundirse: por caducidad o porque la cierre la
   * persona reportada. La información no se borra nunca.
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

  /**
   * El detalle de una denuncia, si quien pregunta puede verlo.
   *
   * Quien la presentó la ve siempre. Cualquier otra persona, solo si llegó a
   * difundirse y nadie la cerró: activa —la que también está en el mapa— o
   * vencida, a la que se llega desde la notificación que ya se recibió. Una sin
   * firmar nunca salió del teléfono de su autor. Y una que la persona reportada
   * cerró dejó de ser asunto de los vecinos: mostrarla seguiría exponiendo su
   * foto después de que pidió detenerla.
   *
   * El rechazo es el mismo que para una que no existe: distinguirlos dejaría
   * sondear qué identificadores esconden una denuncia.
   */
  /**
   * «La encontramos»: quien presentó la denuncia da el caso por terminado.
   *
   * La alerta deja de difundirse para siempre —CERRADA es terminal— y queda la
   * fecha, que mide cuánto tardó en aparecer la persona. No se borra nada (I7):
   * la declaración jurada sigue siendo verificable.
   *
   * Lo que **no** hace es quitarle nada a la persona reportada: puede seguir
   * declarándola falsa, con su falta. Si no fuera así, darla por terminada
   * sería la forma de escapar de la sanción antes de que la persona reaccione.
   *
   * Para cualquiera que no sea su autor, responde como si no existiera.
   */
  async darPorEncontrada(
    userId: string,
    id: string,
  ): Promise<{ denuncia: Denuncia; mensaje: string }> {
    return this.dataSource.transaction(async (manager) => {
      const repositorio = manager.getRepository(Denuncia);
      const denuncia = await repositorio
        .createQueryBuilder('d')
        .where('d.id = :id', { id })
        // Contra un cierre simultáneo de la persona reportada: uno de los dos
        // gana, y el otro ve el estado que dejó.
        .setLock('pessimistic_write')
        .getOne();

      if (!denuncia || denuncia.denunciante_id !== userId) {
        throw new NotFoundException('Denuncia no encontrada');
      }
      if (!puedeTransicionarEstado(denuncia.estado, EstadoDenuncia.CERRADA)) {
        throw new ConflictException(
          denuncia.estado === EstadoDenuncia.INVALIDADA
            ? 'La persona reportada ya cerró esta alerta'
            : 'Esta denuncia ya está cerrada',
        );
      }

      await repositorio.update(id, {
        estado: EstadoDenuncia.CERRADA,
        cerrada_en: () => 'now()',
      });
      await revocarEmisionesPendientes(manager, id, 'quien denunció dio el caso por terminado');

      const seDifundio = denuncia.nivel_confianza !== NivelConfianza.REGISTRADA;
      return {
        denuncia: await repositorio.findOneByOrFail({ id }),
        mensaje: seDifundio
          ? 'Caso cerrado. La alerta dejó de difundirse y ya no se puede reactivar. Gracias por avisar.'
          : 'Denuncia cerrada. No llegó a difundirse.',
      };
    });
  }

  async findVisiblePara(userId: string, id: string): Promise<Denuncia> {
    const denuncia = await this.findOne(id);
    if (denuncia.denunciante_id === userId) return denuncia;

    const seDifundio = denuncia.nivel_confianza !== NivelConfianza.REGISTRADA;
    const sigueAbierta =
      denuncia.estado === EstadoDenuncia.ACTIVA || denuncia.estado === EstadoDenuncia.CADUCADA;
    if (!seDifundio || !sigueAbierta) {
      throw new NotFoundException('Denuncia no encontrada');
    }
    return denuncia;
  }
}
