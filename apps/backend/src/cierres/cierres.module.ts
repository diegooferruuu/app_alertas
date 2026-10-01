import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CierresService } from './cierres.service';
import { CierresController } from './cierres.controller';
import { Cierre } from './entities/cierre.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { SancionesModule } from '../sanciones/sanciones.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cierre, Denuncia, EmisionAlerta, User]),
    UsersModule,
    SancionesModule,
  ],
  controllers: [CierresController],
  providers: [CierresService],
})
export class CierresModule {}
