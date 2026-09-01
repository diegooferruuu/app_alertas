import {
  IsString,
  IsOptional,
  IsBase64,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateDenunciaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre_persona_buscada?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBase64()
  photo_base64?: string;
}
