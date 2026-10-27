import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MOTIVOS_DE_REPORTE, MotivoDeReporte } from '../entities/reporte-contenido.entity';

export class ReportarContenidoDto {
  @IsIn(MOTIVOS_DE_REPORTE)
  motivo!: MotivoDeReporte;

  /** Vacío cuenta como ausente: no se guarda un detalle en blanco. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() || undefined : value))
  @IsString()
  @MaxLength(500)
  detalle?: string;
}
