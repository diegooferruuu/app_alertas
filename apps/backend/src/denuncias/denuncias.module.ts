import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DenunciasService } from './denuncias.service';
import { DenunciasController } from './denuncias.controller';
import { CaducidadScheduler } from './caducidad.scheduler';
import { Denuncia } from './entities/denuncia.entity';
import { FotografiaDenuncia } from './entities/fotografia-denuncia.entity';
import { UsersModule } from '../users/users.module';
import { AlertasModule } from '../alertas/alertas.module';
import { User } from '../users/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Denuncia, FotografiaDenuncia, User]),
    UsersModule,
    AlertasModule,],
  controllers: [DenunciasController],
  providers: [DenunciasService, CaducidadScheduler],
  exports: [DenunciasService],
})
export class DenunciasModule {}
