import { PartesDelNombre } from '../domain/nombre-persona';

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
 *
 * Lleva las partes del nombre y no `full_name`: el nombre completo lo compone
 * `UsersService.create`, de modo que no exista forma de crear una cuenta cuyo
 * nombre completo diga algo distinto de sus partes.
 */
export class CreateUserDto implements PartesDelNombre {
  email!: string;
  primer_nombre!: string;
  segundo_nombre?: string | null;
  primer_apellido!: string;
  segundo_apellido!: string;
  phone!: string;
  password_hash!: string;
}
