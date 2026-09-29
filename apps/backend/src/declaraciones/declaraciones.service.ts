import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { VersionTextoLegal } from './entities/version-texto-legal.entity';

@Injectable()
export class DeclaracionesService {
  constructor(
    @InjectRepository(VersionTextoLegal)
    private versionesRepository: Repository<VersionTextoLegal>,
  ) {}

  /** SHA-256 del texto, para poder comprobar años después que no se alteró. */
  static hashDeTexto(texto: string): string {
    return createHash('sha256').update(texto, 'utf8').digest('hex');
  }

  /**
   * Versión del texto legal que debe mostrarse ahora.
   *
   * Si no hay ninguna vigente el sistema no puede pedir una declaración jurada:
   * mejor fallar de forma visible que dejar firmar contra un texto indefinido.
   */
  async textoLegalVigente(): Promise<VersionTextoLegal> {
    const version = await this.versionesRepository.findOne({
      where: { vigente: true },
    });

    if (!version) {
      throw new NotFoundException(
        'No hay un texto legal vigente. El sistema no puede recibir declaraciones juradas.',
      );
    }

    return version;
  }

  /** Recupera una versión concreta, para reconstruir una declaración pasada. */
  async versionPorId(id: string): Promise<VersionTextoLegal> {
    const version = await this.versionesRepository.findOne({ where: { id } });
    if (!version) {
      throw new NotFoundException('Versión de texto legal no encontrada');
    }
    return version;
  }

  /**
   * Comprueba que el texto guardado siga siendo el que se mostró.
   *
   * Es lo que permite a un tercero verificar una constancia sin confiar en el
   * sistema: recalcula el hash sobre el texto y lo compara con el registrado.
   */
  textoNoAlterado(version: VersionTextoLegal): boolean {
    return DeclaracionesService.hashDeTexto(version.texto) === version.hash_texto;
  }
}
