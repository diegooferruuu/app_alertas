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
 *
 * Por la misma razón —un error que funciona en silencio— comprueba también a
 * qué número se entregan los reportes de avistamiento.
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

/** Un número de teléfono: dígitos, con un «+» inicial opcional. */
const NUMERO = /^\+?\d{3,15}$/;

/**
 * Un celular boliviano, con o sin código de país: 8 dígitos que empiezan con 6
 * o 7.
 *
 * Fuera de producción es lo único que se acepta como número de la autoridad.
 * Se exige la forma en vez de prohibir una lista de números de emergencia
 * porque una lista siempre puede quedar incompleta, y todos los de emergencia
 * son códigos cortos: el 110, y cualquier otro, quedan fuera por construcción.
 */
const CELULAR_BOLIVIANO = /^(\+?591)?[67]\d{7}$/;

/**
 * Los números a los que la app entrega un reporte de avistamiento.
 *
 * Un reporte generado en una prueba no puede llegar a una línea de emergencia
 * real: haría perder tiempo a quien atiende emergencias de verdad. Por eso,
 * fuera de producción, el servidor no arranca si el número no es un celular.
 */
function problemasDeLaAutoridad(config: Record<string, unknown>): string[] {
  const problemas: string[] = [];
  const enProduccion = config.NODE_ENV === 'production';
  const leer = (nombre: string) =>
    typeof config[nombre] === 'string' ? config[nombre].replace(/[\s-]/g, '') : '';

  const telefono = leer('AUTORIDAD_TELEFONO');
  const mensajeria = leer('AUTORIDAD_MENSAJERIA');

  if (!telefono) {
    problemas.push(
      'AUTORIDAD_TELEFONO no está definido: el reporte de avistamiento no tendría a quién llamar.',
    );
  }
  for (const [nombre, valor] of [
    ['AUTORIDAD_TELEFONO', telefono],
    ['AUTORIDAD_MENSAJERIA', mensajeria],
  ] as const) {
    if (!valor) continue;
    if (!NUMERO.test(valor)) {
      problemas.push(`${nombre} solo admite dígitos, con un «+» inicial opcional.`);
    } else if (!enProduccion && !CELULAR_BOLIVIANO.test(valor)) {
      // El valor no se repite en el mensaje: puede ser el celular de alguien.
      problemas.push(
        `${nombre} debe ser un celular de prueba fuera de producción (8 dígitos que empiezan con 6 o 7): ningún reporte de prueba puede llegar a una línea de emergencia.`,
      );
    }
  }
  return problemas;
}

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
  const conSecretos = problemas.length > 0;

  problemas.push(...problemasDeLaAutoridad(config));

  if (problemas.length > 0) {
    throw new Error(
      [
        'Configuración insegura: el servidor no arranca.',
        ...problemas.map((p) => `  - ${p}`),
        ...(conSecretos ? ['Genera cada secreto con: openssl rand -base64 48'] : []),
      ].join('\n'),
    );
  }

  return config;
}
