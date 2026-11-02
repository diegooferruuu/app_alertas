import { codigoDeCaso } from './codigo-de-caso';

describe('Código de caso de una alerta', () => {
  it('son los primeros 8 caracteres del identificador, en mayúsculas', () => {
    expect(codigoDeCaso('5c3f0d7e-1111-4a2b-9c3d-123456789abc')).toBe('5C3F0D7E');
  });

  it('no depende de los guiones del identificador', () => {
    expect(codigoDeCaso('5c3f0d7e1111')).toBe(codigoDeCaso('5c3f0d7e-1111'));
  });
});
