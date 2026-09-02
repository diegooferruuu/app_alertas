import {
  IsString,
  IsNumber,
  IsOptional,
  IsBase64,
  Matches,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateDenunciaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre_persona_buscada!: string;

  /**
   * Número de documento de la persona buscada. Obligatorio, sin excepción.
   *
   * Solo se guarda su hash: es lo que permite que esa persona desactive la
   * alerta si la denuncia es falsa. Sin este dato la denuncia sería
   * irreversible para quien resulta afectado, así que no hay vía alternativa.
   */
  @IsString()
  @Matches(/^\d{5,12}$/, {
    message: 'El documento de la persona buscada debe tener entre 5 y 12 dígitos',
  })
  ci_persona_buscada!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsBase64()
  fotografia_base64?: string;
}
