import { IsEmail, IsString, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizarCorreo } from '../../users/domain/correo';

export class LoginDto {
  /**
   * Se normaliza antes de validar, no después.
   *
   * Puesto en el DTO y no en el servicio, cualquier camino que llegue al inicio
   * de sesión pasa por aquí. Sin esto, `Ana@demo.bo` o un espacio al final
   * devolvían «Credenciales inválidas», que es indistinguible de equivocarse de
   * contraseña.
   */
  @Transform(({ value }) =>
    typeof value === 'string' ? normalizarCorreo(value) : value,
  )
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}
