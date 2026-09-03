import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AlertasService } from './alertas.service';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/**
 * Worker de emisión de alertas.
 *
 * Es el componente que hace que emitir no ocurra dentro de la petición HTTP.
 * Alcanzar a cientos de destinatarios lleva tiempo y puede fallar a medias:
 * dentro de una respuesta agotaría el tiempo de espera del cliente y no
 * admitiría reintento. Aquí nadie está esperando, así que puede tardar y puede
 * reintentar.
 */
@Injectable()
export class EmisionWorker implements OnModuleInit {
  private static readonly NOMBRE_TAREA = 'procesar-emisiones-pendientes';
  private readonly logger = new Logger(EmisionWorker.name);

  /**
   * Evita que un ciclo entre mientras el anterior sigue trabajando.
   *
   * Los trabajos ya se toman con SKIP LOCKED, así que no habría envíos
   * duplicados, pero solaparse acumularía trabajo sin necesidad.
   */
  private enCurso = false;

  constructor(
    private readonly alertasService: AlertasService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const { intervaloEmisionMin } =
      this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);

    const intervalo = setInterval(
      () => void this.ejecutar(),
      intervaloEmisionMin * 60_000,
    );

    this.schedulerRegistry.addInterval(EmisionWorker.NOMBRE_TAREA, intervalo);
    this.logger.log(`Worker de emisión activo cada ${intervaloEmisionMin} min`);
  }

  /**
   * Un fallo aquí no puede tumbar el proceso: es trabajo de fondo sin nadie
   * esperando. Se registra y se reintenta en el siguiente ciclo.
   */
  async ejecutar(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;

    try {
      const procesadas = await this.alertasService.procesarPendientes();
      if (procesadas > 0) {
        this.logger.log(`${procesadas} emisión(es) procesada(s)`);
      }
    } catch (error) {
      this.logger.error(
        `No se pudieron procesar las emisiones: ${(error as Error).message}`,
      );
    } finally {
      this.enCurso = false;
    }
  }
}
