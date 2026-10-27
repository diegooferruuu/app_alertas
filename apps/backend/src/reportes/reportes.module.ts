import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReporteContenido } from './entities/reporte-contenido.entity';
import { ReportesService } from './reportes.service';
import { ReportesController } from './reportes.controller';
import { CorreoService } from './correo.service';
import { DenunciasModule } from '../denuncias/denuncias.module';

@Module({
  imports: [TypeOrmModule.forFeature([ReporteContenido]), DenunciasModule],
  controllers: [ReportesController],
  providers: [ReportesService, CorreoService],
})
export class ReportesModule {}
