import { describe, expect, it } from '@jest/globals';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/curves/abstract/utils';
import { mensajeAFirmar } from './mensaje-de-firma';

describe('mensajeAFirmar', () => {
  it('arma exactamente el mismo mensaje que el servidor', () => {
    // El mismo vector que `firma-dispositivo.spec.ts` del backend.
    expect(
      mensajeAFirmar({
        denuncia_id: '3f2a7c1e-9b4d-4e8a-a1f0-5c6d7e8f9a0b',
        hash_contenido_denuncia: 'a'.repeat(64),
        hash_texto_legal: 'b'.repeat(64),
        vinculo_declarado: 'MADRE',
        texto_firmado: 'María Fernanda Villarroel Quispe',
      }),
    ).toBe(
      [
        'declaracion-jurada/v1',
        '3f2a7c1e-9b4d-4e8a-a1f0-5c6d7e8f9a0b',
        'a'.repeat(64),
        'b'.repeat(64),
        'MADRE',
        'María Fernanda Villarroel Quispe',
      ].join('\n'),
    );
  });
});

describe('Ed25519 en el teléfono', () => {
  it('cumple el vector 1 de la RFC 8032, el mismo que verifica el servidor', () => {
    // @noble/curves aquí y el `crypto` de Node allá: dos implementaciones de
    // acuerdo sobre el estándar.
    const semilla = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');

    expect(bytesToHex(ed25519.getPublicKey(semilla))).toBe(
      'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
    );
    expect(bytesToHex(ed25519.sign(new Uint8Array(0), semilla))).toBe(
      'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
    );
  });

  it('firma los bytes UTF-8 del mensaje: las tildes cuentan', () => {
    const semilla = hexToBytes('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
    const publica = ed25519.getPublicKey(semilla);
    const firma = ed25519.sign(utf8ToBytes('María'), semilla);

    expect(ed25519.verify(firma, utf8ToBytes('María'), publica)).toBe(true);
    expect(ed25519.verify(firma, utf8ToBytes('Maria'), publica)).toBe(false);
  });
});
