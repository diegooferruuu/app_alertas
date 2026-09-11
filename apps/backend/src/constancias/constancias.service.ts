import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  SolicitudConstancia,
  AlcanceConstancia,
} from './entities/solicitud-constancia.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { DeclaracionJurada } from '../declaraciones/entities/declaracion-jurada.entity';
import { VersionTextoLegal } from '../declaraciones/entities/version-texto-legal.entity';
import { VinculoDeclarado } from '../declaraciones/domain/vinculos';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  FORMATO_CONSTANCIA,
  ORDEN_CAMPOS_REGISTRO,
  ORDEN_CAMPOS_CONTENIDO,
  PROCEDIMIENTO_VERIFICACION,
  LIMITES_VERIFICACION,
} from './domain/documento';

/** Una firma, con la identidad de quien la puso. */
export interface FirmanteDeLaConstancia {
  nombre: string;
  /**
   * Documento en hash, porque el número nunca se almacena en claro.
   *
   * No es una carencia: una autoridad que tenga delante el documento de la
   * persona puede aplicarle SHA-256 y comparar. Verifica sin que el sistema haya
   * tenido que guardar el número.
   */
  ci_hash: string;
  vinculo_declarado: VinculoDeclarado;
  tipo: 'original' | 'corroboracion';
  /** Literal, tal como lo tecleó al firmar. */
  texto_firmado: string;
  firmada_en: Date;
  /**
   * Si la declaración lleva firma criptográfica del dispositivo.
   *
   * Cuando es `false`, la integridad del registro se apoya solo en la cadena de
   * hashes, que construye el propio servidor: decirlo es parte de ser honesto
   * sobre lo que la constancia prueba. La firma llega en H6.3.
   */
  con_firma_criptografica: boolean;
}

/**
 * Los campos sellados de una declaración, tal como entran en el hash.
 *
 * Se publican en crudo y en su forma canónica para que un tercero pueda
 * recalcular `hash_registro` sin pedirle nada al sistema.
 */
export interface DeclaracionVerificable {
  denuncia_id: string;
  usuario_id: string;
  ci_hash_declarante: string;
  vinculo_declarado: VinculoDeclarado;
  tipo: 'original' | 'corroboracion';
  version_texto_legal_id: string;
  hash_texto_legal: string;
  texto_firmado: string;
  hash_contenido_denuncia: string;
  /** ISO-8601, exactamente como se serializó al sellar. */
  firmada_en: string;
  device_id: string | null;
  hash_anterior: string | null;
  hash_registro: string;
  firma_criptografica: string | null;
  clave_publica: string | null;
}

export interface Constancia {
  formato: string;
  denuncia_id: string;
  alcance: AlcanceConstancia;
  /**
   * El contenido sellado, en forma canónica.
   *
   * `latitude` y `longitude` viajan como cadena ya redondeada a 7 decimales,
   * que es exactamente lo que entró en el hash: así el verificador no depende
   * de cómo su lenguaje imprima un flotante.
   */
  denuncia: {
    id: string;
    nombre_persona_buscada: string | null;
    ci_hash_persona_buscada: string;
    description: string;
    latitude: string;
    longitude: string;
    estado: string;
    created_at: Date;
  };
  /** Para leer. Los datos que se verifican están en `declaraciones`. */
  firmantes: FirmanteDeLaConstancia[];
  declaraciones: DeclaracionVerificable[];
  /** El texto legal exacto que se mostró, no una referencia a él. */
  textos_legales: Array<{
    id: string;
    version: string;
    texto: string;
    hash_texto: string;
  }>;
  verificacion: {
    algoritmo: 'SHA-256';
    separador: 'U+001F';
    orden_campos_registro: readonly string[];
    orden_campos_contenido: readonly string[];
    procedimiento: string[];
    limites: string[];
  };
  emitida_en: Date;
}

@Injectable()
export class ConstanciasService {
  private readonly logger = new Logger(ConstanciasService.name);

  constructor(
    @InjectRepository(SolicitudConstancia)
    private solicitudesRepository: Repository<SolicitudConstancia>,
    private dataSource: DataSource,
    private usersService: UsersService,
  ) {}

  /**
   * Entrega la constancia de una denuncia y deja registrada la solicitud (§6.1).
   *
   * **No exige justificación.** No hay ante quién justificarse, y un filtro sería
   * decorativo. El fundamento del derecho a esta identidad es directo: quien
   * denunció aceptó la atribución como condición para difundir. Es exactamente lo
   * que firmó, y está escrito en el texto legal que aceptó.
   *
   * Dos vías de autorización, con alcances distintos:
   *
   *  - **La persona reportada** ve a todos los firmantes. Corroborar compromete
   *    igual que denunciar, así que quien respaldó el caso también queda
   *    atribuido frente a ella.
   *  - **Quien firmó** accede solo a su propia declaración: tiene derecho a la
   *    copia de lo que declaró, no a la identidad de los demás.
   *
   * Cualquier otra persona recibe el mismo error que si la denuncia no existiera.
   */
  async solicitar(userId: string, denunciaId: string): Promise<Constancia> {
    const usuario = await this.usersService.findById(userId);

    if (!usuario.documento_registrado || !usuario.ci_hash) {
      throw new ForbiddenException(
        'Registra tu documento de identidad para solicitar una constancia',
      );
    }

    const denuncia = await this.dataSource
      .getRepository(Denuncia)
      .createQueryBuilder('d')
      .addSelect('d.ci_hash_persona_buscada')
      .where('d.id = :id', { id: denunciaId })
      .getOne();

    if (!denuncia) throw new NotFoundException('Denuncia no encontrada');

    const declaraciones = await this.dataSource
      .getRepository(DeclaracionJurada)
      .find({ where: { denuncia_id: denunciaId }, order: { firmada_en: 'ASC' } });

    const esPersonaBuscada =
      denuncia.ci_hash_persona_buscada === usuario.ci_hash;
    const propias = declaraciones.filter((d) => d.usuario_id === userId);

    let alcance: AlcanceConstancia;
    let entregadas: DeclaracionJurada[];

    if (esPersonaBuscada) {
      alcance = 'completa';
      entregadas = declaraciones;
    } else if (propias.length > 0) {
      alcance = 'propia_declaracion';
      entregadas = propias;
    } else {
      // Igual que en el interruptor: distinguir «no existe» de «no es tuya»
      // convertiría esto en una forma de sondear denuncias ajenas.
      throw new NotFoundException('Denuncia no encontrada');
    }

    if (entregadas.length === 0) {
      throw new NotFoundException(
        'Esta denuncia no tiene ninguna declaración jurada: nadie la firmó todavía',
      );
    }

    const firmantes = await this.identificarFirmantes(entregadas);
    const textosLegales = await this.textosLegalesDe(entregadas);

    await this.solicitudesRepository.insert({
      denuncia_id: denunciaId,
      solicitante_id: userId,
      ci_hash_solicitante: usuario.ci_hash,
      alcance,
    });

    this.logger.log(
      `Constancia entregada (${alcance}) de la denuncia ${denunciaId}`,
    );

    return {
      formato: FORMATO_CONSTANCIA,
      denuncia_id: denunciaId,
      alcance,
      denuncia: {
        id: denuncia.id,
        nombre_persona_buscada: denuncia.nombre_persona_buscada,
        ci_hash_persona_buscada: denuncia.ci_hash_persona_buscada,
        description: denuncia.description,
        // La misma precisión con la que se selló; ver `calcularHashContenido`.
        latitude: Number(denuncia.latitude).toFixed(7),
        longitude: Number(denuncia.longitude).toFixed(7),
        estado: denuncia.estado,
        created_at: denuncia.created_at,
      },
      firmantes,
      declaraciones: entregadas.map((d) => ({
        denuncia_id: d.denuncia_id,
        usuario_id: d.usuario_id,
        ci_hash_declarante: d.ci_hash_declarante,
        vinculo_declarado: d.vinculo_declarado,
        tipo: d.tipo,
        version_texto_legal_id: d.version_texto_legal_id,
        hash_texto_legal: d.hash_texto_legal,
        texto_firmado: d.texto_firmado,
        hash_contenido_denuncia: d.hash_contenido_denuncia,
        // Se serializa igual que al sellar: de eso depende que el hash cuadre.
        firmada_en: d.firmada_en.toISOString(),
        device_id: d.device_id,
        hash_anterior: d.hash_anterior,
        hash_registro: d.hash_registro,
        firma_criptografica: d.firma_criptografica,
        // La clave pública del dispositivo llega con H6.3; sin ella la firma no
        // se puede verificar aunque exista.
        clave_publica: null as string | null,
      })),
      textos_legales: textosLegales,
      verificacion: {
        algoritmo: 'SHA-256',
        separador: 'U+001F',
        orden_campos_registro: ORDEN_CAMPOS_REGISTRO,
        orden_campos_contenido: ORDEN_CAMPOS_CONTENIDO,
        procedimiento: PROCEDIMIENTO_VERIFICACION,
        limites: LIMITES_VERIFICACION,
      },
      emitida_en: new Date(),
    };
  }

  /**
   * El texto legal exacto que se mostró, no una referencia.
   *
   * Sin el texto entero, `hash_texto_legal` no se puede recalcular y habría que
   * pedirle el original al sistema — justo lo que la constancia evita.
   */
  private async textosLegalesDe(declaraciones: DeclaracionJurada[]) {
    const ids = [...new Set(declaraciones.map((d) => d.version_texto_legal_id))];
    const versiones = await this.dataSource
      .getRepository(VersionTextoLegal)
      .findByIds(ids);

    return versiones.map((v) => ({
      id: v.id,
      version: v.version,
      texto: v.texto,
      hash_texto: v.hash_texto,
    }));
  }

  /**
   * Pone nombre a cada declaración.
   *
   * Usa `nombre_documento` —el que se contrastó contra el carnet— y no el que se
   * tecleó al crear la cuenta, que no lo comprobó nadie. Es el mismo nombre
   * contra el que se validó la firma escrita a mano.
   */
  private async identificarFirmantes(
    declaraciones: DeclaracionJurada[],
  ): Promise<FirmanteDeLaConstancia[]> {
    const usuarios = this.dataSource.getRepository(User);

    return Promise.all(
      declaraciones.map(async (d) => {
        const firmante = await usuarios.findOne({
          where: { id: d.usuario_id },
          select: { id: true, nombre_documento: true, full_name: true },
        });

        return {
          nombre: firmante?.nombre_documento ?? firmante?.full_name ?? 'Desconocido',
          ci_hash: d.ci_hash_declarante,
          vinculo_declarado: d.vinculo_declarado,
          tipo: d.tipo,
          texto_firmado: d.texto_firmado,
          firmada_en: d.firmada_en,
          con_firma_criptografica: d.firma_criptografica !== null,
        };
      }),
    );
  }

  /** Historial de solicitudes sobre una denuncia. Rastro de auditoría. */
  async solicitudesDe(denunciaId: string): Promise<SolicitudConstancia[]> {
    return this.solicitudesRepository.find({
      where: { denuncia_id: denunciaId },
      order: { solicitada_en: 'ASC' },
    });
  }
}
