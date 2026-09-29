import { validarEntorno } from './validar-entorno';

const ACCESO = 'a'.repeat(40);
const REFRESCO = 'b'.repeat(40);

describe('validarEntorno', () => {
  it('deja pasar dos secretos largos y distintos', () => {
    const config = { JWT_SECRET: ACCESO, JWT_REFRESH_SECRET: REFRESCO, OTRA: 'x' };
    expect(validarEntorno(config)).toBe(config);
  });

  it('rechaza los valores de ejemplo publicados en el repositorio', () => {
    expect(() =>
      validarEntorno({
        JWT_SECRET: 'your_jwt_secret_key_here_min_32_chars',
        JWT_REFRESH_SECRET: REFRESCO,
      }),
    ).toThrow(/JWT_SECRET es el valor de ejemplo/);

    expect(() =>
      validarEntorno({
        JWT_SECRET: ACCESO,
        JWT_REFRESH_SECRET: 'your_refresh_secret_key_here_min_32_chars',
      }),
    ).toThrow(/JWT_REFRESH_SECRET es el valor de ejemplo/);
  });

  it('rechaza un secreto que falta o está vacío', () => {
    expect(() => validarEntorno({ JWT_REFRESH_SECRET: REFRESCO })).toThrow(
      /JWT_SECRET no está definido/,
    );
    expect(() =>
      validarEntorno({ JWT_SECRET: '   ', JWT_REFRESH_SECRET: REFRESCO }),
    ).toThrow(/JWT_SECRET no está definido/);
  });

  it('rechaza un secreto de menos de 32 caracteres', () => {
    expect(() =>
      validarEntorno({ JWT_SECRET: 'corto', JWT_REFRESH_SECRET: REFRESCO }),
    ).toThrow(/JWT_SECRET tiene 5 caracteres/);
  });

  it('rechaza el mismo valor para los dos secretos', () => {
    expect(() =>
      validarEntorno({ JWT_SECRET: ACCESO, JWT_REFRESH_SECRET: ACCESO }),
    ).toThrow(/son iguales/);
  });

  it('reúne todos los problemas en un solo error', () => {
    expect(() => validarEntorno({})).toThrow(
      /JWT_SECRET no está definido[\s\S]*JWT_REFRESH_SECRET no está definido/,
    );
  });
});
