/**
 * Códigos con que el servidor rechaza una acción que la cuenta tiene
 * restringida. Llegan junto al mensaje: `{ codigo, message }`.
 *
 * El mensaje ya viene escrito para la persona. El código sirve para lo que el
 * texto no puede hacer solo: titular el aviso y ofrecer el paso siguiente.
 */
export type CodigoRestriccion =
  | 'CUENTA_SUSPENDIDA'
  | 'CUENTA_SUSPENDIDA_TEMPORALMENTE'
  | 'DENUNCIA_SOBRE_PERSONA_BLOQUEADA'
  | 'DENUNCIA_ABIERTA_SOBRE_PERSONA'
  | 'LIMITE_ALERTAS_PROVISIONALES';

const TITULOS: Record<CodigoRestriccion, string> = {
  CUENTA_SUSPENDIDA: 'Cuenta suspendida',
  CUENTA_SUSPENDIDA_TEMPORALMENTE: 'No puedes denunciar por unos días',
  DENUNCIA_SOBRE_PERSONA_BLOQUEADA: 'No puedes denunciar a esta persona',
  DENUNCIA_ABIERTA_SOBRE_PERSONA: 'Ya denunciaste a esta persona',
  LIMITE_ALERTAS_PROVISIONALES: 'Límite de alertas a la vez',
};

export interface Rechazo {
  titulo: string;
  mensaje: string;
  /** Solo si fue una restricción del régimen de sanciones. */
  codigo?: CodigoRestriccion;
}

const esCodigo = (valor: unknown): valor is CodigoRestriccion =>
  typeof valor === 'string' && valor in TITULOS;

/**
 * Lo que hay que decirle a la persona cuando una petición falla.
 *
 * Con código, el título lo pone la restricción; sin él, el que se pase. El
 * mensaje del servidor manda siempre que exista: la regla vive allí, y repetir
 * aquí su redacción permitiría que las dos se contradijeran.
 */
export function rechazoDe(err: any, porDefecto: { titulo: string; mensaje: string }): Rechazo {
  const datos = err?.response?.data;
  const mensaje = Array.isArray(datos?.message)
    ? datos.message.join('\n')
    : datos?.message || porDefecto.mensaje;

  const codigo: unknown = datos?.codigo;
  if (esCodigo(codigo)) {
    return { titulo: TITULOS[codigo], mensaje, codigo };
  }
  return { titulo: porDefecto.titulo, mensaje };
}
