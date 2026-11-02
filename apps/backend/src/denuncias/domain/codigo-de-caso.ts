/**
 * El código corto con que se nombra una alerta fuera de la aplicación.
 *
 * Lo llevan el reporte de avistamiento y la ficha pública, para que quien
 * recibe un reporte pueda decir «el caso 5C3F0D7E» y quien abre la ficha vea el
 * mismo código: los dos documentos hablan de la misma alerta sin que haga falta
 * leer un identificador de 36 caracteres por teléfono.
 *
 * Son los primeros 8 caracteres del identificador, en mayúsculas. No es un
 * número de caso policial —ese no es público y el sistema no lo guarda— ni un
 * secreto: es una abreviatura del identificador, que ya va en el enlace de la
 * ficha. Con 8 cifras hexadecimales, dos alertas comparten código una vez cada
 * varios miles de millones; el enlace lleva el identificador entero y es el que
 * decide en ese caso.
 *
 * La app calcula el mismo código (`apps/mobile/src/utils/reporte-avistamiento.ts`):
 * cambiar uno es cambiar el otro.
 */
export const codigoDeCaso = (denunciaId: string): string =>
  denunciaId.replace(/-/g, '').slice(0, 8).toUpperCase();
