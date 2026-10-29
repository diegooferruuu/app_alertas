/**
 * Lo que el servidor exige de una contraseña nueva (`RegisterDto`), para
 * mostrarlo mientras se escribe y no dejar enviar una que va a ser rechazada.
 *
 * Tiene que decir exactamente lo mismo que el servidor. Las letras cuentan de la
 * A a la Z, sin la ñ ni las vocales con tilde, porque así las cuenta su
 * expresión regular: una «Ñ» no es mayúscula para él, y marcarla en verde aquí
 * sería prometer un registro que va a fallar.
 */
export const LARGO_MINIMO_DE_CONTRASENA = 8;

export interface Requisito {
  clave: 'largo' | 'mayuscula' | 'minuscula' | 'numero' | 'coinciden';
  texto: string;
  cumplido: boolean;
}

export interface EstadoDeLaContrasena {
  requisitos: Requisito[];
  /** Solo con todos cumplidos se puede crear la cuenta. */
  valida: boolean;
}

/**
 * Cada requisito, cumplido o no, en el orden en que se muestran.
 *
 * Que las dos coincidan va en la misma lista: el botón queda apagado también
 * por eso, y un botón apagado sin un motivo a la vista no se entiende.
 */
export function estadoDeLaContrasena(
  contrasena: string,
  repeticion: string,
): EstadoDeLaContrasena {
  const requisitos: Requisito[] = [
    {
      clave: 'largo',
      texto: `Al menos ${LARGO_MINIMO_DE_CONTRASENA} caracteres`,
      // Por caracteres y no por unidades de UTF-16: así los cuenta el servidor,
      // y un emoji vale uno, no dos.
      cumplido: Array.from(contrasena).length >= LARGO_MINIMO_DE_CONTRASENA,
    },
    { clave: 'mayuscula', texto: 'Una letra mayúscula', cumplido: /[A-Z]/.test(contrasena) },
    { clave: 'minuscula', texto: 'Una letra minúscula', cumplido: /[a-z]/.test(contrasena) },
    { clave: 'numero', texto: 'Un número', cumplido: /[0-9]/.test(contrasena) },
    {
      clave: 'coinciden',
      texto: 'Las dos contraseñas coinciden',
      // Dos campos vacíos son iguales, pero no hay nada que dar por bueno.
      cumplido: repeticion.length > 0 && contrasena === repeticion,
    },
  ];
  return { requisitos, valida: requisitos.every((r) => r.cumplido) };
}
