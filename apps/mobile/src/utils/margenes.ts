/**
 * Cuánto separar del borde de abajo lo último de una hoja o de un modal.
 *
 * Desde que la app apunta a Android 15 y posteriores, el sistema la dibuja de
 * borde a borde: la barra de navegación —los tres botones, o la línea de los
 * gestos— queda encima del contenido. `margenDelSistema` es lo que esa barra
 * ocupa (el `bottom` de `useSafeAreaInsets`), y sobre ella se deja un respiro.
 *
 * El mínimo conserva la separación que estas hojas ya tenían en un teléfono sin
 * barra, para que allí no cambie nada.
 */
export const separacionInferior = (margenDelSistema: number, minimo = 32): number =>
  Math.max(minimo, margenDelSistema + 16);
