import { IsBase64, IsString, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

/** Datos que la persona declara; se comparan con los extraídos del documento. */
export class PersonalDataDto {
  @IsString()
  full_name: string = '';

  @IsString()
  ci_number: string = '';

  @IsString()
  birth_place: string = '';

  @IsDateString()
  birth_date: string = '';
}

/** Paso intermedio: comprobar legibilidad y coincidencia, sin dejar constancia. */
export class ExtraerDatosDocumentoDto {
  @IsBase64()
  id_front_base64: string = '';

  @IsBase64()
  id_back_base64: string = '';

  @ValidateNested()
  @Type(() => PersonalDataDto)
  personal_data: PersonalDataDto = new PersonalDataDto();
}

/** Paso final: deja constancia del documento en la cuenta. */
export class RegistrarDocumentoDto {
  @IsBase64()
  id_front_base64: string = '';

  @IsBase64()
  id_back_base64: string = '';

  @IsBase64()
  selfie_base64: string = '';

  @ValidateNested()
  @Type(() => PersonalDataDto)
  personal_data: PersonalDataDto = new PersonalDataDto();
}
