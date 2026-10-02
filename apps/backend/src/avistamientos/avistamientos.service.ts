import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AUTORIDAD_CONFIG, AutoridadConfig } from '../config/autoridad.config';
import { CanalAvistamiento } from './entities/uso-canal-avistamiento.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';

/**
 * El lado del servidor de un reporte de avistamiento, que es casi nada.
 *
 * El reporte se arma y se entrega en el teléfono (I2). El servidor solo dice a
 * quién entregarlo y cuenta, sin saber quién, que se usó un canal.
 */
@Injectable()
export class AvistamientosService {
  constructor(
    private dataSource: DataSource,
    private configService: ConfigService,
  ) {}

  contactoDeLaAutoridad(): AutoridadConfig {
    return this.configService.getOrThrow<AutoridadConfig>(AUTORIDAD_CONFIG);
  }

  /**
   * Anota que se usó un canal. No recibe a quién: no hay forma de pasárselo.
   *
   * Solo cuenta sobre una alerta que alguien pudo recibir: difundida y sin
   * cerrar, vigente o vencida. Sobre cualquier otra no escribe nada, y para
   * quien llama el resultado es el mismo. Una sola sentencia: comprobar y
   * escribir por separado dejaría contar sobre una alerta cerrada entre medio.
   */
  async registrarUsoDeCanal(denunciaId: string, canal: CanalAvistamiento): Promise<void> {
    await this.dataSource.query(
      `INSERT INTO usos_canal_avistamiento (denuncia_id, canal)
       SELECT id, $2 FROM denuncias
        WHERE id = $1
          AND estado = ANY($3)
          AND nivel_confianza <> $4`,
      [
        denunciaId,
        canal,
        [EstadoDenuncia.ACTIVA, EstadoDenuncia.CADUCADA],
        NivelConfianza.REGISTRADA,
      ],
    );
  }
}
