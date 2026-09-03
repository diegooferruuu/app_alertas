import { Injectable, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  SolicitudConstancia,
  AlcanceConstancia,
} from './entities/solicitud-constancia.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { DeclaracionJurada } from '../declaraciones/entities/declaracion-jurada.entity';
import { VinculoDeclarado } from '../declaraciones/domain/vinculos';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

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

export interface Constancia {
  denuncia_id: string;
  alcance: AlcanceConstancia;
  denuncia: {
    nombre_persona_buscada: string | null;
    description: string;
    created_at: Date;
    estado: string;
  };
  firmantes: FirmanteDeLaConstancia[];
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
      denuncia_id: denunciaId,
      alcance,
      denuncia: {
        nombre_persona_buscada: denuncia.nombre_persona_buscada,
        description: denuncia.description,
        created_at: denuncia.created_at,
        estado: denuncia.estado,
      },
      firmantes,
      emitida_en: new Date(),
    };
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
