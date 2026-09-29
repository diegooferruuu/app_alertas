import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export class RegistrarDispositivoDto {
  @IsString()
  @MinLength(10)
  @MaxLength(255)
  push_token!: string;

  @IsString()
  @IsIn(['android', 'ios'])
  plataforma!: string;
}
