import {
  IsString,
  IsNumber,
  IsOptional,
  IsBase64,
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
  photo_base64?: string;
}
