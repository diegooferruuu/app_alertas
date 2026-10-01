import { ConflictException, ForbiddenException, HttpException } from '@nestjs/common';
import type { CodigoRestriccion } from './domain/situacion';

/**
 * Rechazo de una acción restringida, con un código que la app sabe explicar.
 *
 * Nunca un error genérico: quien recibe un «no» tiene que poder entender por
 * qué, y la app muestra el mensaje tal cual. El código permite además que la
 * app reaccione distinto según el caso —ofrecer registrar el caso de la FELCC,
 * por ejemplo— sin depender de la redacción del mensaje.
 *
 * 403 cuando es una restricción de la cuenta; 409 cuando choca con el estado de
 * otra cosa —una denuncia ya abierta, un límite de uso—.
 */
export function restriccion(
  codigo: CodigoRestriccion,
  mensaje: string,
  estado: 403 | 409 = 403,
): HttpException {
  const cuerpo = { codigo, message: mensaje };
  return estado === 403 ? new ForbiddenException(cuerpo) : new ConflictException(cuerpo);
}
