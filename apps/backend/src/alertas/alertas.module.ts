import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertasService } from './alertas.service';
import { DispositivosService } from './dispositivos.service';
import { UbicacionService } from './ubicacion.service';
import { AlertasController } from './alertas.controller';
import { EmisionWorker } from './emision.worker';
import { PasarelaPush, PasarelaPushSimulada } from './pasarela-push';
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
    // La pasarela real de Expo se enlaza aquí cuando el dev build esté listo:
    // es lo único que cambia para pasar de envío simulado a envío real.
    { provide: PasarelaPush, useClass: PasarelaPushSimulada },
  ],
  exports: [AlertasService, DispositivosService],
})
export class AlertasModule {}
