/**
 * Mayoría de edad de la persona buscada, y qué se puede difundir de un menor.
 *
 * La regla del sistema es una sola: **la alerta de un menor de edad no lleva
 * fotografía.** La imagen de un niño difundida por un canal abierto llega a
 * cualquiera que esté en la zona, no solo a quien podría reconocerlo, y esa
 * difusión no se puede deshacer: retirar la alerta no retira las copias.
 *
 * Se prohíbe **adjuntarla**, no solo mostrarla. Una fotografía que nunca entró
 * al sistema no se puede filtrar, ni exponer por un fallo de permisos, ni queda
 * pendiente de purgar más adelante. La alternativa —guardarla y ocultarla—
 * traslada el problema a que ningún endpoint futuro se equivoque, que es una
 * garantía mucho más débil.
 *
 * El costo es real y hay que decirlo: sin retrato, reconocer a un menor depende
 * de la descripción física. Es la contrapartida deliberada de no difundir su
 * imagen.
 */

/** Años cumplidos a partir de los cuales la persona no es menor. */
export const MAYORIA_DE_EDAD = 18;

/**
 * Años cumplidos en una fecha de referencia.
 *
 * Cuenta cumpleaños, no divide días entre 365: con esa división, alguien que
 * cumple años mañana ya figuraría con la edad nueva uno de cada cuatro años por
 * los bisiestos. Aquí el límite se cruza el día exacto.
 */
export const edadEn = (nacimiento: Date, referencia: Date): number => {
  let edad = referencia.getFullYear() - nacimiento.getFullYear();

  const cumpleEsteAnio =
    referencia.getMonth() > nacimiento.getMonth() ||
    (referencia.getMonth() === nacimiento.getMonth() &&
      referencia.getDate() >= nacimiento.getDate());

  if (!cumpleEsteAnio) edad -= 1;
  return edad;
};

/**
 * Si la persona buscada es menor **hoy**, no cuando desapareció.
 *
 * Se mide contra la fecha actual y no contra el último avistamiento a
 * propósito: lo que se protege es a quien la alerta va a exponer ahora. Alguien
 * que desapareció siendo menor y hoy ya cumplió dieciocho deja de necesitar
 * esta protección; alguien reportado el día antes de cumplirlos, no.
 *
 * Una fecha ausente se trata como **no menor**. Es lo que sostiene la
 * obligatoriedad de la fotografía para todos los demás casos: si la ausencia
 * eximiera de foto, omitir la fecha sería la forma de saltarse el requisito.
 * Que el campo sea obligatorio al crear lo resuelve por el otro lado.
 */
export const esMenorDeEdad = (
  nacimiento: Date | string | null | undefined,
  referencia: Date = new Date(),
): boolean => {
  if (!nacimiento) return false;

  const fecha = aFechaLocal(nacimiento);
  if (Number.isNaN(fecha.getTime())) return false;

  return edadEn(fecha, referencia) < MAYORIA_DE_EDAD;
};

/**
 * Interpreta la fecha en el día natural que dice, sin zona horaria.
 *
 * La columna es `date` y TypeORM la devuelve como `'YYYY-MM-DD'`. Pasarla por
 * `new Date('1990-05-20')` la lee como medianoche **UTC**, que en Bolivia (UTC−4)
 * es el 19 de mayo a las 20:00: un día menos. En un límite de edad eso cambia el
 * resultado para quien cumple años justo hoy.
 */
const aFechaLocal = (valor: Date | string): Date => {
  if (valor instanceof Date) return valor;

  const [anio, mes, dia] = valor.slice(0, 10).split('-').map(Number);
  return new Date(anio, (mes ?? 1) - 1, dia ?? 1);
};

/** Mensaje único, para que la app y el servidor digan exactamente lo mismo. */
export const MOTIVO_SIN_FOTOGRAFIA =
  'La persona buscada es menor de edad, así que la alerta no lleva fotografía. Se difundirá con la descripción física.';
