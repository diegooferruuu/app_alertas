import { createHash } from 'crypto';
import {
  COMPLEMENTO,
  NUMERO_DE_CEDULA,
  documentoCanonico,
  hashDeDocumento,
  normalizarComplemento,
} from './documento-identidad';

const sha256 = (texto: string) => createHash('sha256').update(texto).digest('hex');

describe('Identidad del documento: número y complemento', () => {
  it('sin complemento, el hash es el de siempre: nada de lo guardado cambia', () => {
    // Antes se resumía el número solo. Quien no tiene complemento —casi todos—
    // tiene que seguir teniendo el mismo hash, o su cuenta y sus denuncias
    // quedarían desvinculadas.
    for (const sinComplemento of [undefined, null, '', '  ']) {
      expect(hashDeDocumento('1234567', sinComplemento)).toBe(sha256('1234567'));
    }
  });

  it('el mismo número con distinto complemento son documentos distintos', () => {
    const hashes = new Set([
      hashDeDocumento('12345678'),
      hashDeDocumento('12345678', '1K'),
      hashDeDocumento('12345678', '2K'),
    ]);

    expect(hashes.size).toBe(3);
  });

  it('el complemento se normaliza: mayúsculas, sin espacios ni guiones', () => {
    for (const escrito of ['1K', '1k', ' 1K ', '-1K', '1 k']) {
      expect(documentoCanonico('12345678', escrito)).toBe('12345678-1K');
    }
    expect(normalizarComplemento('   ')).toBeNull();
  });

  it('la forma canónica lleva guion: sin él, dos documentos distintos darían la misma cadena', () => {
    expect(documentoCanonico('12345678', '1K')).not.toBe(documentoCanonico('123456781', 'K'));
    expect(hashDeDocumento('12345678', '1K')).toBe(sha256('12345678-1K'));
  });

  it('el número lleva solo dígitos y el complemento uno o dos caracteres', () => {
    expect(NUMERO_DE_CEDULA.test('12345678')).toBe(true);
    expect(NUMERO_DE_CEDULA.test('12345678-1K')).toBe(false);
    expect(NUMERO_DE_CEDULA.test('1234567 LP')).toBe(false);
    expect(COMPLEMENTO.test('1K')).toBe(true);
    expect(COMPLEMENTO.test('k')).toBe(true);
    expect(COMPLEMENTO.test('1K2')).toBe(false);
    expect(COMPLEMENTO.test('1-')).toBe(false);
  });
});
