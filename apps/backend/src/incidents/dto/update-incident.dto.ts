import {
  IsString,
  IsOptional,
  IsBase64,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateIncidentDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  victim_name?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBase64()
  photo_base64?: string;
}
