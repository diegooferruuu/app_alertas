import { describe, expect, it } from '@jest/globals';
import { textoDelMensaje } from './mensaje-del-servidor';

describe('Mensaje de error del servidor', () => {
  it('un texto queda igual', () => {
    expect(textoDelMensaje('Credenciales inválidas')).toBe('Credenciales inválidas');
  });

  it('la lista de la validación se une en líneas', () => {
    expect(
      textoDelMensaje([
        'La contraseña debe tener al menos 8 caracteres',
        'La contraseña debe tener una mayúscula, una minúscula y un número',
      ]),
    ).toBe(
      'La contraseña debe tener al menos 8 caracteres\n' +
        'La contraseña debe tener una mayúscula, una minúscula y un número',
    );
  });

  it('lo que no es texto no llega a la pantalla', () => {
    expect(textoDelMensaje(undefined)).toBeUndefined();
    expect(textoDelMensaje('')).toBeUndefined();
    expect(textoDelMensaje([])).toBeUndefined();
    expect(textoDelMensaje({ campo: 'x' })).toBeUndefined();
    expect(textoDelMensaje([3, null, 'Falta el teléfono'])).toBe('Falta el teléfono');
  });
});
