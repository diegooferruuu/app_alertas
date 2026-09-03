import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeclaracionesService } from './declaraciones.service';
import { FirmasService } from './firmas.service';
import { DeclaracionesController } from './declaraciones.controller';
import { VersionTextoLegal } from './entities/version-texto-legal.entity';
import { DeclaracionJurada } from './entities/declaracion-jurada.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { UsersModule } from '../users/users.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([VersionTextoLegal, DeclaracionJurada, Denuncia]),
    UsersModule,
    AlertasModule,
  ],
  controllers: [DeclaracionesController],
  providers: [DeclaracionesService, FirmasService],
  exports: [DeclaracionesService, FirmasService],
})
export class DeclaracionesModule {}
