import { IsEmail, IsString, MinLength, Matches, IsPhoneNumber } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email: string = '';

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password: string = '';

  @IsString()
  @MinLength(3)
  full_name: string = '';

  @IsString()
  @IsPhoneNumber('BO')
  phone: string = '';

  @IsString()
  id_card_base64: string = '';
}
