import { IsBase64 } from 'class-validator';

export class VerifyIdentityDto {
  @IsBase64()
  id_card_base64: string = '';
}
