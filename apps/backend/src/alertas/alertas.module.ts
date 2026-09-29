import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertasService } from './alertas.service';
import { DispositivosService } from './dispositivos.service';
import { UbicacionService } from './ubicacion.service';
import { AlertasController } from './alertas.controller';
import { EmisionWorker } from './emision.worker';
import { RecibosWorker } from './recibos.worker';
import { PasarelaPush, PasarelaPushSimulada } from './pasarela-push';
import { PasarelaPushExpo } from './pasarela-push-expo';
import { Dispositivo } from './entities/dispositivo.entity';
import { EmisionAlerta } from './entities/emision-alerta.entity';
import { EntregaAlerta } from './entities/entrega-alerta.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispositivo,
      EmisionAlerta,
      EntregaAlerta,
      Denuncia,
      User,
    ]),
  ],
  controllers: [AlertasController],
  providers: [
    AlertasService,
    DispositivosService,
    UbicacionService,
    EmisionWorker,
    RecibosWorker,
    {
      provide: PasarelaPush,
      inject: [ConfigService],
      /**
       * Qué pasarela se usa lo decide `PUSH_PASARELA`, y se anuncia al arrancar.
       *
       * Es una variable explícita y no una deducción a partir de `NODE_ENV`
       * porque el modo equivocado no da ningún síntoma: la simulada registra
       * «enviado», marca las entregas como aceptadas y deja los registros con
       * buen aspecto mientras nadie recibe nada. En un sistema de alerta
       * temprana ese es el peor fallo posible —silencioso y del lado de creer
       * que funciona—, así que la elección se declara y se grita en el arranque.
       *
       * Por defecto es la simulada: equivocarse hacia no enviar es recuperable;
       * equivocarse hacia mandar notificaciones reales desde una máquina de
       * desarrollo, a teléfonos de personas, no lo es.
       */
      useFactory: (config: ConfigService): PasarelaPush => {
        const logger = new Logger('PasarelaPush');
        const modo = config.get<string>('PUSH_PASARELA') ?? 'simulada';

        if (modo === 'expo') {
          logger.log('Pasarela REAL de Expo: las notificaciones se envían a teléfonos.');
          return new PasarelaPushExpo(config);
        }

        if (modo !== 'simulada') {
          logger.warn(`PUSH_PASARELA="${modo}" no se reconoce; se usa la simulada.`);
        }
        logger.warn('Pasarela SIMULADA: no se envía nada. PUSH_PASARELA=expo para enviar de verdad.');
        return new PasarelaPushSimulada();
      },
    },
  ],
  exports: [AlertasService, DispositivosService],
})
export class AlertasModule {}
