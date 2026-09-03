import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeclaracionesService } from './declaraciones.service';
import { DeclaracionesController } from './declaraciones.controller';
import { VersionTextoLegal } from './entities/version-texto-legal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([VersionTextoLegal])],
  controllers: [DeclaracionesController],
  providers: [DeclaracionesService],
  exports: [DeclaracionesService],
})
export class DeclaracionesModule {}
