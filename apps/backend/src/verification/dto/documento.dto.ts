import {
  IsBase64,
  IsString,
  IsDateString,
  IsOptional,
  Matches,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { COMPLEMENTO, NUMERO_DE_CEDULA } from '../../users/domain/documento-identidad';

/**
 * Datos que la persona declara; se comparan con los extraídos del documento.
 *
 * No incluye el nombre. El nombre ya se declaró, desglosado, al crear la cuenta,
 * y es el de la cuenta el que se contrasta contra el carnet: aceptarlo otra vez
 * aquí permitiría declarar en este paso un nombre distinto del de la cuenta.
 */
export class PersonalDataDto {
  @IsString()
  @Matches(NUMERO_DE_CEDULA, {
    message: 'El número de carnet lleva solo dígitos, entre 5 y 12',
  })
  ci_number: string = '';

  /**
   * El complemento, solo si el carnet lo tiene: `1K` en `12345678-1K`. Es parte
   * de la identidad del documento (ver `documento-identidad.ts`), y si el carnet
   * lo muestra, declararlo es obligatorio.
   */
  @IsOptional()
  @Matches(COMPLEMENTO, { message: 'El complemento son uno o dos caracteres, como 1K' })
  ci_complemento?: string;

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
