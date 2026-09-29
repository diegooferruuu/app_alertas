/**
 * Si la persona buscada es menor de edad, la alerta no lleva fotografía.
 *
 * **Copia deliberada de la regla del servidor** (`denuncias/domain/minoria-edad.ts`),
 * que es la que manda. Aquí solo sirve para que el formulario no ofrezca algo
 * que después va a ser rechazado: pedir una foto y devolverla con un error es
 * peor experiencia que no pedirla. Si las dos versiones se separan, la que vale
 * es la del servidor y esta pantalla queda desincronizada, no insegura.
 *
 * Está duplicada porque no hay paquete compartido: `packages/shared` se eliminó
 * por estar muerto. Es el mismo costo que ya se paga con los catálogos de enums.
 */

/** Años cumplidos a partir de los cuales la persona no es menor. */
export const MAYORIA_DE_EDAD = 18;

/**
 * Se mide contra hoy, no contra cuándo desapareció: lo que se protege es a
 * quien la alerta va a exponer ahora.
 */
export const esMenorDeEdad = (
  nacimiento: Date | null | undefined,
  referencia: Date = new Date(),
): boolean => {
  if (!nacimiento || Number.isNaN(nacimiento.getTime())) return false;

  let edad = referencia.getFullYear() - nacimiento.getFullYear();

  // Cuenta cumpleaños, no divide días entre 365: el límite se cruza el día
  // exacto y no un día antes por los bisiestos.
  const yaCumplio =
    referencia.getMonth() > nacimiento.getMonth() ||
    (referencia.getMonth() === nacimiento.getMonth() &&
      referencia.getDate() >= nacimiento.getDate());

  if (!yaCumplio) edad -= 1;
  return edad < MAYORIA_DE_EDAD;
};
