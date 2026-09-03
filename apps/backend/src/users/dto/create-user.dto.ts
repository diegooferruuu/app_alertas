/**
 * Datos con los que se crea una cuenta.
 *
 * No es un DTO de cuerpo HTTP: nadie lo valida en un controlador. `AuthService`
 * lo arma en código a partir de `RegisterDto` —ya validado— y de la contraseña
 * ya cifrada. Por eso lleva `password_hash` y no `password`, y por eso no
 * necesita decoradores de validación.
 *
 * Campos con `!` y sin inicializador, como el resto de los DTO del proyecto: un
 * `= ''` compilaría a una asignación real que dejaría propiedades fantasma en la
 * instancia.
 */
export class CreateUserDto {
  email!: string;
  full_name!: string;
  phone!: string;
  password_hash!: string;
}
