import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { DenunciasService } from './denuncias.service';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/**
 * Planificador de caducidad de alertas.
 *
 * La caducidad se implementa por dos vías simultáneas, y esto es solo una de
 * ellas. La otra es el filtro por `expira_en` que llevan todas las consultas de
 * casos difundibles, y es la que garantiza corrección: aunque este planificador
 * no llegue a correr —proceso caído, reinicio, error—, una denuncia vencida
 * jamás aparece en una consulta.
 *
 * Lo que aporta este componente es dejar el vencimiento reflejado en la columna
 * `estado`, para que el dato sea legible sin recalcularlo y para que las
 * consultas de la validación del sistema no tengan que interpretar fechas.
 */
@Injectable()
export class CaducidadScheduler implements OnModuleInit {
  private static readonly NOMBRE_TAREA = 'caducar-alertas-vencidas';
  private readonly logger = new Logger(CaducidadScheduler.name);

  constructor(
    private readonly denunciasService: DenunciasService,
    private readonly configService: ConfigService,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  /**
   * Se registra un intervalo y no una expresión cron por dos razones: el valor
   * es configurable —y el decorador @Cron exige una constante en tiempo de
   * compilación—, y «cada N minutos» es literalmente un intervalo.
   *
   * Una expresión cron con paso de 7 minutos, además, no reparte cada 7: dispara
   * en los minutos 0, 7, 14 … 56 y luego salta al 0, dejando un hueco de 4.
   * El intervalo no tiene esa rareza.
   */
  onModuleInit() {
    const { intervaloCaducidadMin } =
      this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);

    const intervalo = setInterval(
      () => void this.ejecutar(),
      intervaloCaducidadMin * 60_000,
    );

    this.schedulerRegistry.addInterval(CaducidadScheduler.NOMBRE_TAREA, intervalo);

    this.logger.log(
      `Caducidad de alertas programada cada ${intervaloCaducidadMin} min`,
    );
  }

  /**
   * Un fallo aquí no puede tumbar el proceso: es una tarea de fondo sin nadie
   * esperando respuesta, y el filtro por `expira_en` sigue protegiendo mientras
   * tanto. Se registra y se reintenta en el siguiente tick.
   */
  async ejecutar(): Promise<void> {
    try {
      const caducadas = await this.denunciasService.caducarVencidas();
      if (caducadas > 0) {
        this.logger.log(`${caducadas} alerta(s) caducada(s) por vencimiento`);
      }
    } catch (error) {
      this.logger.error(
        `No se pudo ejecutar la caducidad de alertas: ${(error as Error).message}`,
      );
    }
  }
}
