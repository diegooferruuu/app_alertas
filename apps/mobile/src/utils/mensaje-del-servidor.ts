/**
 * El `message` de una respuesta de error del servidor, siempre como texto.
 *
 * La validación de Nest lo devuelve como lista cuando una petición rompe más de
 * una regla. Pasada tal cual a `Alert.alert`, Android cierra la aplicación: su
 * diálogo nativo exige texto y una lista no se convierte sola. Así se perdía, sin
 * aviso, a quien escribía una contraseña débil al crear la cuenta.
 *
 * Lo que no es texto ni lista de textos se descarta: mejor el mensaje por
 * defecto de cada pantalla que un cierre.
 */
export function textoDelMensaje(mensaje: unknown): string | undefined {
  if (typeof mensaje === 'string') return mensaje || undefined;
  if (Array.isArray(mensaje)) {
    const partes = mensaje.filter((m): m is string => typeof m === 'string' && m.length > 0);
    return partes.length > 0 ? partes.join('\n') : undefined;
  }
  return undefined;
}
