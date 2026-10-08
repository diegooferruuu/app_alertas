import { generateKeyPairSync, sign } from 'crypto';

/**
 * Un teléfono para las pruebas: un par de claves Ed25519 real, generado con el
 * módulo `crypto` de Node, que firma igual que la app con `@noble/curves`.
 *
 * Firmas de verdad y no de relleno: una prueba de «la firma se verifica» con
 * firmas inventadas no probaría nada.
 */
export interface TelefonoDePrueba {
  /** Los 32 bytes de la clave pública, en hexadecimal minúscula. */
  clavePublica: string;
  firmar: (mensaje: string) => string;
}

export function telefonoDePrueba(): TelefonoDePrueba {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const { x } = publicKey.export({ format: 'jwk' });
  return {
    clavePublica: Buffer.from(x!, 'base64url').toString('hex'),
    firmar: (mensaje) => sign(null, Buffer.from(mensaje, 'utf8'), privateKey).toString('hex'),
  };
}
