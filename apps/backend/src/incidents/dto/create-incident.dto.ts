import {
  IsString,
  IsIn,
  IsNumber,
  IsOptional,
  IsBase64,
  Min,
  Max,
  MaxLength,
  MinLength,
} from 'class-validator';

// Por ahora las denuncias son únicamente sobre desapariciones
const CATEGORIES = ['desaparicion'];

export class CreateIncidentDto {
  @IsString()
  @IsIn(CATEGORIES)
  category!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
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
