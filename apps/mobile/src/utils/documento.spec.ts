import { describe, expect, it } from '@jest/globals';
import { complementoParaEnviar, limpiarComplemento } from './documento';

describe('complemento del carnet', () => {
  it('se escribe en mayúsculas, sin el guion que la gente copia del carnet', () => {
    expect(limpiarComplemento('-1k')).toBe('1K');
    expect(limpiarComplemento(' 1 k ')).toBe('1K');
    expect(limpiarComplemento('1K2')).toBe('1K');
  });

  it('vacío no viaja: la mayoría de los carnets no tiene complemento', () => {
    expect(complementoParaEnviar('')).toBeUndefined();
    expect(complementoParaEnviar('  ')).toBeUndefined();
    expect(complementoParaEnviar('-')).toBeUndefined();
    expect(complementoParaEnviar('1k')).toBe('1K');
  });
});
