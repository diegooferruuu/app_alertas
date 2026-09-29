import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { AlertasService } from './alertas.service';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/**
 * Worker de recibos de entrega.
 *
 * Es un ciclo propio y no una etapa del de emisión a propósito: pedir recibos
 * puede tardar —hasta cincuenta consultas a la pasarela por ciclo— y la emisión
 * no puede esperar detrás de eso. Una alerta que sale tarde es peor que un
 * recibo que se consulta tarde.
 */
@Injectable()
export class RecibosWorker implements OnModuleInit {
  private static readonly NOMBRE_TAREA = 'consultar-recibos-de-entrega';
  private readonly logger = new Logger(RecibosWorker.name);

  /** Evita que un ciclo entre mientras el anterior sigue consultando. */
  private enCurso = false;

  constructor(
    private readonly alertasService: AlertasService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit() {
    const { intervaloRecibosMin } =
      this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);

    const intervalo = setInterval(
      () => void this.ejecutar(),
      intervaloRecibosMin * 60_000,
    );

    this.schedulerRegistry.addInterval(RecibosWorker.NOMBRE_TAREA, intervalo);
    this.logger.log(`Worker de recibos activo cada ${intervaloRecibosMin} min`);
  }

  /** Como el de emisión: un fallo se registra y se reintenta en el siguiente ciclo. */
  async ejecutar(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;

    try {
      const resueltas = await this.alertasService.procesarRecibos();
      if (resueltas > 0) {
        this.logger.log(`${resueltas} entrega(s) con recibo resuelto`);
      }
    } catch (error) {
      this.logger.error(
        `No se pudieron procesar los recibos: ${(error as Error).message}`,
      );
    } finally {
      this.enCurso = false;
    }
  }
}
