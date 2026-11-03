import { describe, expect, it } from '@jest/globals';
import { separacionInferior } from './margenes';

describe('Separación del borde de abajo', () => {
  it('con la barra de tres botones, lo último queda por encima de ella', () => {
    // 48 dp es la altura de la barra de tres botones de Android.
    expect(separacionInferior(48)).toBe(64);
  });

  it('sin barra, se conserva la separación de antes', () => {
    expect(separacionInferior(0)).toBe(32);
    expect(separacionInferior(0, 34)).toBe(34);
  });

  it('nunca queda pegado a la barra, aunque sea más alta que el mínimo', () => {
    expect(separacionInferior(34)).toBeGreaterThan(34);
  });
});
