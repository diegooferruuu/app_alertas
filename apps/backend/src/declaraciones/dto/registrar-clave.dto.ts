import { Matches } from 'class-validator';
import { CLAVE_PUBLICA_HEX } from '../domain/firma-dispositivo';

/** Solo la mitad pública. La privada nunca sale del teléfono. */
export class RegistrarClaveDto {
  @Matches(CLAVE_PUBLICA_HEX, {
    message: 'La clave pública debe ser Ed25519 de 32 bytes, en hexadecimal minúscula',
  })
  clave_publica!: string;
}
