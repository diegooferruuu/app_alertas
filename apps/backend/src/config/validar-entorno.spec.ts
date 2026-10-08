import { validarEntorno } from './validar-entorno';

const ACCESO = 'a'.repeat(40);
const REFRESCO = 'b'.repeat(40);
/** Ficticio: tiene la forma de un celular, nada más. */
const CELULAR_DE_PRUEBA = '70000000';

/** Un entorno que pasa: lo que cada prueba no cambia queda válido. */
const valido = (cambios: Record<string, unknown> = {}) => ({
  JWT_SECRET: ACCESO,
  JWT_REFRESH_SECRET: REFRESCO,
  AUTORIDAD_TELEFONO: CELULAR_DE_PRUEBA,
  ...cambios,
});

describe('validarEntorno', () => {
  it('deja pasar dos secretos largos y distintos', () => {
    const config = { ...valido(), OTRA: 'x' };
    expect(validarEntorno(config)).toBe(config);
  });

  describe('número de la autoridad', () => {
    it('exige el número al que se llama con un avistamiento', () => {
      expect(() => validarEntorno(valido({ AUTORIDAD_TELEFONO: undefined }))).toThrow(
        /AUTORIDAD_TELEFONO no está definido/,
      );
    });

    it('fuera de producción no arranca apuntando al 110', () => {
      // Ningún reporte generado en una prueba puede llegar a la línea real.
      expect(() => validarEntorno(valido({ AUTORIDAD_TELEFONO: '110' }))).toThrow(
        /AUTORIDAD_TELEFONO debe ser un celular de prueba/,
      );
      expect(() =>
        validarEntorno(valido({ NODE_ENV: 'development', AUTORIDAD_TELEFONO: '110' })),
      ).toThrow(/celular de prueba/);
    });

    it('rechaza cualquier código corto, no solo los de una lista', () => {
      for (const corto of ['911', '119', '1234']) {
        expect(() => validarEntorno(valido({ AUTORIDAD_TELEFONO: corto }))).toThrow(
          /celular de prueba/,
        );
      }
    });

    it('acepta un celular, con o sin código de país', () => {
      for (const numero of ['70000000', '60000000', '+59170000000', '59170000000', '7000 0000']) {
        expect(() => validarEntorno(valido({ AUTORIDAD_TELEFONO: numero }))).not.toThrow();
      }
    });

    it('en producción acepta el 110', () => {
      expect(() =>
        validarEntorno(valido({ NODE_ENV: 'production', AUTORIDAD_TELEFONO: '110' })),
      ).not.toThrow();
    });

    it('la mensajería es opcional, pero si está pasa por la misma regla', () => {
      expect(() => validarEntorno(valido({ AUTORIDAD_MENSAJERIA: '' }))).not.toThrow();
      expect(() =>
        validarEntorno(valido({ AUTORIDAD_MENSAJERIA: CELULAR_DE_PRUEBA })),
      ).not.toThrow();
      expect(() => validarEntorno(valido({ AUTORIDAD_MENSAJERIA: '110' }))).toThrow(
        /AUTORIDAD_MENSAJERIA debe ser un celular de prueba/,
      );
    });

    it('rechaza lo que no es un número', () => {
      expect(() => validarEntorno(valido({ AUTORIDAD_TELEFONO: 'policia' }))).toThrow(
        /solo admite dígitos/,
      );
    });

    it('no repite el número en el error: puede ser el celular de alguien', () => {
      expect(() => validarEntorno(valido({ AUTORIDAD_TELEFONO: '1234567' }))).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining('1234567') }),
      );
    });

    it('sin problemas de secretos, no sugiere generar secretos', () => {
      expect(() => validarEntorno(valido({ AUTORIDAD_TELEFONO: '110' }))).toThrow(
        expect.objectContaining({ message: expect.not.stringContaining('openssl') }),
      );
    });
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
