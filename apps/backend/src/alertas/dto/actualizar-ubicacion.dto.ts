import { IsNumber, Max, Min } from 'class-validator';

/**
 * Última ubicación conocida de la persona.
 *
 * El sistema opera sobre esta posición registrada, no sobre dónde está ahora.
 * Es una limitación declarada del enfoque, no algo que convenga disimular.
 */
export class ActualizarUbicacionDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}
