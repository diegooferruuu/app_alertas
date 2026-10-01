import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SancionesService } from './sanciones.service';
import { SancionesController } from './sanciones.controller';
import { Falta } from './entities/falta.entity';
import { DocumentoBloqueado } from './entities/documento-bloqueado.entity';
import { Cierre } from '../cierres/entities/cierre.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Falta, DocumentoBloqueado, Cierre, Denuncia, User]),
    UsersModule,
  ],
  controllers: [SancionesController],
  providers: [SancionesService],
  // Lo usan el cierre (para sancionar), la creación de denuncias y la firma
  // (para hacer cumplir las restricciones).
  exports: [SancionesService],
})
export class SancionesModule {}
