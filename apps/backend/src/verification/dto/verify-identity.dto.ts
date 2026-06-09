import { IsBase64, IsString, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

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

export class VerifyIdCardDto {
  @IsBase64()
  id_front_base64: string = '';

  @IsBase64()
  id_back_base64: string = '';

  @ValidateNested()
  @Type(() => PersonalDataDto)
  personal_data: PersonalDataDto = new PersonalDataDto();
}

export class VerifyIdentityDto {
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
