import { createPublicKey, verify } from 'crypto';

/**
 * Lo que firma el teléfono al declarar, y cómo se verifica.
 *
 * **No firma `hash_registro`.** Ese hash lo calcula el servidor al sellar, con
 * la hora del servidor y el eslabón anterior de la cadena, y el teléfono no
 * puede conocerlo de antemano. Firma lo declarado: la denuncia, su contenido
 * sellado, el texto legal que se mostró, el vínculo y el nombre escrito. Con
 * eso, nadie sin la clave privada —tampoco el operador del sistema— puede
 * fabricar una declaración atribuida a alguien.
 *
 * El formato es texto, una línea por campo, con un encabezado que lo versiona.
 * El nombre escrito va al final: es el único texto libre, y así ni un salto de
 * línea dentro de él podría correr los campos anteriores, que tienen formato
 * fijo. El teléfono arma exactamente lo mismo (`mensaje-de-firma.ts` del
 * móvil); un vector de prueba compartido verifica que coinciden.
 */
export const ENCABEZADO_MENSAJE_FIRMA = 'declaracion-jurada/v1';

export const ORDEN_CAMPOS_MENSAJE_FIRMA = [
  'denuncia_id',
  'hash_contenido_denuncia',
  'hash_texto_legal',
  'vinculo_declarado',
  'texto_firmado',
] as const;

export type DatosFirmados = Record<(typeof ORDEN_CAMPOS_MENSAJE_FIRMA)[number], string>;

export const mensajeAFirmar = (datos: DatosFirmados): string =>
  [ENCABEZADO_MENSAJE_FIRMA, ...ORDEN_CAMPOS_MENSAJE_FIRMA.map((campo) => datos[campo])].join(
    '\n',
  );

/** 32 bytes de clave pública, 64 de firma: Ed25519, en hexadecimal minúscula. */
export const CLAVE_PUBLICA_HEX = /^[0-9a-f]{64}$/;
export const FIRMA_HEX = /^[0-9a-f]{128}$/;

/**
 * Comprueba una firma Ed25519 con el módulo `crypto` de Node, sin bibliotecas.
 *
 * Lo que sea malformado —clave o firma con otro largo, hexadecimal inválido—
 * cuenta como firma inválida, no como error: para quien firma, el resultado es
 * el mismo.
 */
export function firmaValida(clavePublicaHex: string, mensaje: string, firmaHex: string): boolean {
  if (!CLAVE_PUBLICA_HEX.test(clavePublicaHex) || !FIRMA_HEX.test(firmaHex)) return false;
  try {
    const clave = createPublicKey({
      key: {
        kty: 'OKP',
        crv: 'Ed25519',
        x: Buffer.from(clavePublicaHex, 'hex').toString('base64url'),
      },
      format: 'jwk',
    });
    return verify(null, Buffer.from(mensaje, 'utf8'), clave, Buffer.from(firmaHex, 'hex'));
  } catch {
    return false;
  }
}
