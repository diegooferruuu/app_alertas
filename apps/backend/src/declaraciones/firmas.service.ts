import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DeclaracionJurada } from './entities/declaracion-jurada.entity';
import { FirmarDeclaracionDto } from './dto/firmar-declaracion.dto';
import { DeclaracionesService } from './declaraciones.service';
import {
  VinculoDeclarado,
  tieneAlcanceReducido,
} from './domain/vinculos';
import {
  calcularHashContenido,
  calcularHashRegistro,
  contieneSeparador,
  verificarCadena,
} from './domain/cadena';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { NivelConfianza, EstadoDenuncia } from '../denuncias/domain/estados';
import { UsersService } from '../users/users.service';
import { nombreEscritoCoincide } from '../verification/domain/nombres';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/**
 * El acto de firma de una declaración jurada.
 *
 * Es el punto donde una denuncia deja de estar callada y empieza a difundirse,
 * así que concentra las comprobaciones que el diseño no admite saltarse.
 */
@Injectable()
export class FirmasService {
  constructor(
    @InjectRepository(DeclaracionJurada)
    private declaracionesRepository: Repository<DeclaracionJurada>,
    private dataSource: DataSource,
    private declaracionesService: DeclaracionesService,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  private get config(): DenunciasConfig {
    return this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);
  }

  /**
   * Alcance y plazo según el vínculo declarado.
   *
   * `TERCERO_NO_FAMILIAR` entra con radio menor y caducidad más corta, nunca con
   * un rechazo: muchas desapariciones reales las reportan compañeros de cuarto o
   * personal de instituciones de acogida, y son los casos más vulnerables.
   */
  private alcanceSegunVinculo(vinculo: VinculoDeclarado): {
    radio_m: number;
    horas: number;
  } {
    const c = this.config;
    return tieneAlcanceReducido(vinculo)
      ? { radio_m: c.radioTerceroNoFamiliarM, horas: c.caducidadTerceroNoFamiliarH }
      : { radio_m: c.radioProvisionalM, horas: c.caducidadProvisionalH };
  }

  /**
   * Firma la declaración y difunde la denuncia.
   *
   * Todo ocurre en una transacción con un cerrojo: la cadena de hashes exige que
   * los registros se sellen en serie. Sin el cerrojo, dos firmas simultáneas
   * leerían el mismo «último registro» y ambas apuntarían al mismo eslabón,
   * dejando la cadena bifurcada y por lo tanto inverificable.
   */
  async firmar(
    userId: string,
    denunciaId: string,
    dto: FirmarDeclaracionDto,
  ): Promise<{ firmada: boolean; nivel_confianza: NivelConfianza }> {
    const usuario = await this.usersService.findById(userId);

    if (!usuario.documento_registrado || !usuario.nombre_documento) {
      throw new ForbiddenException(
        'Debes registrar tu documento antes de firmar una declaración jurada',
      );
    }
    if (usuario.is_suspended) {
      throw new ForbiddenException('Tu cuenta está suspendida');
    }

    // El nombre se compara contra el que quedó registrado con el documento, no
    // contra el que se tecleó al crear la cuenta.
    if (!nombreEscritoCoincide(dto.nombre_escrito, usuario.nombre_documento)) {
      throw new BadRequestException(
        'El nombre escrito no coincide con el de tu documento registrado',
      );
    }
    if (contieneSeparador(dto.nombre_escrito)) {
      throw new BadRequestException('El nombre contiene caracteres no permitidos');
    }

    const version = await this.declaracionesService.versionPorId(
      dto.version_texto_legal_id,
    );
    const vinculo = dto.vinculo_declarado as VinculoDeclarado;

    return this.dataSource.transaction(async (manager) => {
      // Serializa el sellado de la cadena entre peticiones concurrentes.
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        FirmasService.CERROJO_CADENA,
      ]);

      const denuncias = manager.getRepository(Denuncia);
      const denuncia = await denuncias
        .createQueryBuilder('denuncia')
        .addSelect('denuncia.ci_hash_persona_buscada')
        .where('denuncia.id = :id', { id: denunciaId })
        .getOne();

      if (!denuncia) {
        throw new BadRequestException('Denuncia no encontrada');
      }
      if (denuncia.denunciante_id !== userId) {
        throw new ForbiddenException('Solo puedes firmar tus propias denuncias');
      }
      if (denuncia.estado !== EstadoDenuncia.ACTIVA) {
        throw new ConflictException(
          `Una denuncia ${denuncia.estado} no puede firmarse`,
        );
      }
      if (denuncia.nivel_confianza !== NivelConfianza.REGISTRADA) {
        throw new ConflictException('Esta denuncia ya fue declarada bajo juramento');
      }

      const declaraciones = manager.getRepository(DeclaracionJurada);
      const ultima = await declaraciones
        .createQueryBuilder('d')
        .orderBy('d.firmada_en', 'DESC')
        .addOrderBy('d.id', 'DESC')
        .limit(1)
        .getOne();

      // La marca temporal la pone el servidor, nunca el cliente: es parte de lo
      // que la constancia acredita.
      const firmadaEn = new Date();

      const campos = {
        denuncia_id: denuncia.id,
        usuario_id: userId,
        ci_hash_declarante: usuario.ci_hash,
        vinculo_declarado: vinculo,
        tipo: 'original',
        version_texto_legal_id: version.id,
        hash_texto_legal: version.hash_texto,
        texto_firmado: dto.nombre_escrito,
        hash_contenido_denuncia: calcularHashContenido({
          nombre_persona_buscada: denuncia.nombre_persona_buscada,
          ci_hash_persona_buscada: denuncia.ci_hash_persona_buscada,
          description: denuncia.description,
          latitude: denuncia.latitude,
          longitude: denuncia.longitude,
        }),
        firmada_en: firmadaEn.toISOString(),
        device_id: dto.device_id ?? null,
        hash_anterior: ultima?.hash_registro ?? null,
      };

      await declaraciones.insert({
        ...campos,
        tipo: 'original' as const,
        vinculo_declarado: vinculo,
        firmada_en: firmadaEn,
        hash_registro: calcularHashRegistro(campos),
      });

      const { radio_m, horas } = this.alcanceSegunVinculo(vinculo);
      const expiraEn = new Date(firmadaEn.getTime() + horas * 3_600_000);

      await denuncias.update(denuncia.id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: radio_m,
        expira_en: expiraEn,
      });

      return { firmada: true, nivel_confianza: NivelConfianza.PROVISIONAL };
    });
  }

  /** Identificador arbitrario pero estable del cerrojo de la cadena. */
  private static readonly CERROJO_CADENA = 828_101;

  /** Declaraciones de una denuncia, en orden de firma. */
  async deLaDenuncia(denunciaId: string): Promise<DeclaracionJurada[]> {
    return this.declaracionesRepository.find({
      where: { denuncia_id: denunciaId },
      order: { firmada_en: 'ASC' },
    });
  }

  /** Convierte una fila en los campos que entran en su hash. */
  private static camposDe(registro: DeclaracionJurada) {
    return {
      denuncia_id: registro.denuncia_id,
      usuario_id: registro.usuario_id,
      ci_hash_declarante: registro.ci_hash_declarante,
      vinculo_declarado: registro.vinculo_declarado,
      tipo: registro.tipo,
      version_texto_legal_id: registro.version_texto_legal_id,
      hash_texto_legal: registro.hash_texto_legal,
      texto_firmado: registro.texto_firmado,
      hash_contenido_denuncia: registro.hash_contenido_denuncia,
      firmada_en: registro.firmada_en.toISOString(),
      device_id: registro.device_id,
      hash_anterior: registro.hash_anterior,
      hash_registro: registro.hash_registro,
    };
  }

  /**
   * Verifica la cadena completa de declaraciones.
   *
   * Detecta tanto un registro alterado como uno suprimido: si falta un eslabón
   * intermedio, el siguiente apunta a un hash que ya no está. Es la operación
   * que sostiene la constancia probatoria de la fase 6, y la que permite a un
   * tercero comprobar el registro sin confiar en quien opera el sistema.
   */
  async verificarCadenaCompleta(): Promise<{
    intacta: boolean;
    registros: number;
    primerEslabonRoto: number | null;
  }> {
    const todas = await this.declaracionesRepository.find({
      order: { firmada_en: 'ASC', id: 'ASC' },
    });

    const roto = verificarCadena(todas.map(FirmasService.camposDe));

    return {
      intacta: roto === null,
      registros: todas.length,
      primerEslabonRoto: roto,
    };
  }
}
