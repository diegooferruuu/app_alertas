import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Dispositivo, Plataforma } from './entities/dispositivo.entity';

@Injectable()
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivo)
    private dispositivosRepository: Repository<Dispositivo>,
  ) {}

  /**
   * Registra un dispositivo o actualiza el que ya existía con ese token.
   *
   * El token identifica al aparato, no a la persona. Si alguien inicia sesión
   * con otra cuenta en el mismo teléfono, el token pasa a la cuenta nueva en
   * lugar de duplicarse: de lo contrario la persona anterior seguiría recibiendo
   * alertas en un dispositivo que ya no controla.
   */
  async registrar(
    usuarioId: string,
    pushToken: string,
    plataforma: Plataforma,
  ): Promise<Dispositivo> {
    const existente = await this.dispositivosRepository.findOne({
      where: { push_token: pushToken },
    });

    if (existente) {
      existente.usuario_id = usuarioId;
      existente.plataforma = plataforma;
      existente.ultima_actividad = new Date();
      return this.dispositivosRepository.save(existente);
    }

    return this.dispositivosRepository.save(
      this.dispositivosRepository.create({
        usuario_id: usuarioId,
        push_token: pushToken,
        plataforma,
        ultima_actividad: new Date(),
      }),
    );
  }

  /** Marca actividad; permite descartar aparatos abandonados al emitir. */
  async registrarActividad(usuarioId: string): Promise<void> {
    await this.dispositivosRepository.update(
      { usuario_id: usuarioId },
      { ultima_actividad: new Date() },
    );
  }

  async deUsuario(usuarioId: string): Promise<Dispositivo[]> {
    return this.dispositivosRepository.find({
      where: { usuario_id: usuarioId },
      order: { ultima_actividad: 'DESC' },
    });
  }
}
