import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DesactivacionesService } from './desactivaciones.service';
import { DesactivacionesController } from './desactivaciones.controller';
import { Desactivacion } from './entities/desactivacion.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Desactivacion, Denuncia, EmisionAlerta, User]),
    UsersModule,
  ],
  controllers: [DesactivacionesController],
  providers: [DesactivacionesService],
  // Se exporta porque la sanción graduada (H4.5) se apoya en el recuento de
  // desactivaciones recibidas.
  exports: [DesactivacionesService],
})
export class DesactivacionesModule {}
