import { IsString, Matches, MaxLength } from 'class-validator';

export class RegistrarCasoFelccDto {
  /**
   * Número de caso de la FELCC.
   *
   * Formato abierto a propósito: la numeración varía entre unidades y fijar un
   * patrón rechazaría casos legítimos por una diferencia de formato.
   */
  @IsString()
  @Matches(/^[A-Za-z0-9\/\-. ]{3,60}$/, {
    message: 'El número de caso contiene caracteres no válidos',
  })
  @MaxLength(60)
  numero_caso!: string;
}
