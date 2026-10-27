import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class EliminarCuentaDto {
  /**
   * La contraseña de la cuenta, aunque haya sesión: eliminarla es irreversible
   * y un teléfono desbloqueado en otras manos no debe bastar.
   *
   * Sin `MinLength`: una contraseña corta de una cuenta antigua tiene que poder
   * confirmar igual, y la que no coincide se rechaza en el servicio.
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password!: string;
}
