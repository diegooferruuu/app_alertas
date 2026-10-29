import { describe, expect, it } from '@jest/globals';
import { estadoDeLaContrasena } from './contrasena';

const cumplidos = (contrasena: string, repeticion = contrasena) =>
  Object.fromEntries(
    estadoDeLaContrasena(contrasena, repeticion).requisitos.map((r) => [r.clave, r.cumplido]),
  );

describe('Requisitos de la contraseña al crear la cuenta', () => {
  it('sin escribir nada no se cumple ninguno', () => {
    const estado = estadoDeLaContrasena('', '');
    expect(estado.requisitos.every((r) => !r.cumplido)).toBe(true);
    expect(estado.valida).toBe(false);
  });

  it('cada requisito se cumple por separado', () => {
    expect(cumplidos('abcdefgh')).toMatchObject({
      largo: true,
      mayuscula: false,
      minuscula: true,
      numero: false,
    });
    expect(cumplidos('A1')).toMatchObject({
      largo: false,
      mayuscula: true,
      minuscula: false,
      numero: true,
    });
  });

  it('con todos cumplidos y las dos iguales, se puede crear', () => {
    expect(estadoDeLaContrasena('Password1', 'Password1').valida).toBe(true);
  });

  it('una contraseña buena que no se repitió igual no basta', () => {
    const estado = estadoDeLaContrasena('Password1', 'Password2');
    expect(cumplidos('Password1', 'Password2').coinciden).toBe(false);
    expect(estado.valida).toBe(false);
  });

  it('la ñ y las tildes no cuentan como letras, igual que en el servidor', () => {
    expect(cumplidos('ÑANDÚ123')).toMatchObject({ mayuscula: true, minuscula: false });
    expect(cumplidos('ñandú123')).toMatchObject({ mayuscula: false, minuscula: true });
    expect(cumplidos('ÑÁÉ1ñáé2')).toMatchObject({ mayuscula: false, minuscula: false });
  });

  it('el largo se cuenta por caracteres, no por unidades de UTF-16', () => {
    // Nueve unidades de UTF-16, seis caracteres: el servidor la rechaza.
    expect(cumplidos('Aa1😀😀😀').largo).toBe(false);
  });
});
