import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvistamientosController } from './avistamientos.controller';
import { AvistamientosService } from './avistamientos.service';
import { UsoCanalAvistamiento } from './entities/uso-canal-avistamiento.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UsoCanalAvistamiento])],
  controllers: [AvistamientosController],
  providers: [AvistamientosService],
})
export class AvistamientosModule {}
