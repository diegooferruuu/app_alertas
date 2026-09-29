/**
 * Validación del entorno al arrancar.
 *
 * Corre una sola vez, cuando `ConfigModule` lee el `.env`, y si algo no está
 * bien el servidor **no arranca**. Un servidor con un secreto débil funciona
 * perfectamente —firma sesiones y las acepta— y nada delata que cualquiera
 * pueda fabricarlas: por eso no basta con documentarlo, hay que impedirlo.
 *
 * Pasó el 2026-09-28: el `.env` usaba los valores de ejemplo del README, y el
 * repositorio es público. Con ellos, cualquiera que lo leyera podía firmar un
 * token válido para un usuario del que conociera el identificador —y firmar
 * declaraciones juradas a su nombre, que es justo lo que la atribución impide.
 */

/**
 * Valores que alguna vez se publicaron como ejemplo. Siguen en la historia del
 * repositorio, así que no pueden volver a ser secretos nunca.
 */
const SECRETOS_PUBLICADOS = new Set([
  'your_jwt_secret_key_here_min_32_chars',
  'your_refresh_secret_key_here_min_32_chars',
]);

/**
 * La RFC 7518 exige para HS256 —el algoritmo con que se firman los tokens— una
 * clave de al menos 256 bits: 32 bytes.
 */
const LARGO_MINIMO = 32;

const SECRETOS = ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const;

export function validarEntorno(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const problemas: string[] = [];

  for (const nombre of SECRETOS) {
    const valor = typeof config[nombre] === 'string' ? config[nombre].trim() : '';
    if (!valor) {
      problemas.push(`${nombre} no está definido.`);
    } else if (SECRETOS_PUBLICADOS.has(valor)) {
      problemas.push(
        `${nombre} es el valor de ejemplo publicado en el repositorio: cualquiera puede firmar sesiones con él.`,
      );
    } else if (valor.length < LARGO_MINIMO) {
      problemas.push(
        `${nombre} tiene ${valor.length} caracteres; hacen falta al menos ${LARGO_MINIMO}.`,
      );
    }
  }

  // Con el mismo valor, un token de refresco —que dura días— pasaría la
  // verificación de los de acceso, que duran minutos.
  if (problemas.length === 0 && config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    problemas.push('JWT_SECRET y JWT_REFRESH_SECRET son iguales; deben ser distintos.');
  }

  if (problemas.length > 0) {
    throw new Error(
      [
        'Configuración insegura: el servidor no arranca.',
        ...problemas.map((p) => `  - ${p}`),
        'Genera cada secreto con: openssl rand -base64 48',
      ].join('\n'),
    );
  }

  return config;
}
