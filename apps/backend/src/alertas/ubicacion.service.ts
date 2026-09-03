import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { DispositivosService } from './dispositivos.service';

@Injectable()
export class UbicacionService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dispositivosService: DispositivosService,
  ) {}

  /**
   * Guarda la última ubicación conocida.
   *
   * `last_location_at` es tan importante como el punto: sin saber cuándo se
   * registró, no se puede excluir de una alerta a quien no reporta posición
   * desde hace días, ni medir sobre qué antigüedad de datos opera el sistema.
   */
  async actualizar(
    usuarioId: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({
        last_location: () =>
          `ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography`,
        last_location_at: new Date(),
      })
      .where('id = :id', { id: usuarioId })
      .execute();

    // Quien reporta ubicación está usando la app: su dispositivo está vivo.
    await this.dispositivosService.registrarActividad(usuarioId);
  }
}
