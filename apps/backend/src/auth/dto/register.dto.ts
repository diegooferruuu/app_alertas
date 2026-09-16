import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  FORMA_DE_PARTE,
  LARGO_MAXIMO_DE_PARTE,
} from '../../users/domain/nombre-persona';
import { normalizarCorreo } from '../../users/domain/correo';

/**
 * Cada parte del nombre se valida igual: forma de nombre y largo acotado. El
 * mensaje se arma con la etiqueta que ve la persona para que el rechazo diga
 * cuál de los cuatro campos está mal, y no un genérico «nombre inválido».
 */
const EsParteDelNombre = (etiqueta: string) =>
  Matches(FORMA_DE_PARTE, {
    message: `${etiqueta} solo admite letras`,
  });

export class RegisterDto {
  /**
   * Se guarda en forma canónica: minúsculas y sin espacios alrededor.
   *
   * Sin esto, el mismo correo en distinta caja creaba dos cuentas distintas. En
   * un sistema cuya garantía es la atribución, dos identidades para una misma
   * persona no son una molestia sino un agujero.
   */
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarCorreo(value) : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message: 'Password must contain uppercase, lowercase, and number',
  })
  password!: string;

  // El nombre llega desglosado, no como una sola cadena: ver
  // `users/domain/nombre-persona.ts`. `full_name` no se acepta del cliente; el
  // servidor lo compone.
  @IsString()
  @MaxLength(LARGO_MAXIMO_DE_PARTE)
  @EsParteDelNombre('El primer nombre')
  primer_nombre!: string;

  /** Opcional de verdad: mucha gente no tiene segundo nombre. */
  @IsOptional()
  @IsString()
  @MaxLength(LARGO_MAXIMO_DE_PARTE)
  @EsParteDelNombre('El segundo nombre')
  segundo_nombre?: string;

  @IsString()
  @MaxLength(LARGO_MAXIMO_DE_PARTE)
  @EsParteDelNombre('El primer apellido')
  primer_apellido!: string;

  @IsString()
  @MaxLength(LARGO_MAXIMO_DE_PARTE)
  @EsParteDelNombre('El segundo apellido')
  segundo_apellido!: string;

  @IsString()
  @IsPhoneNumber('BO')
  phone!: string;
}
