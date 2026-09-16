import { normalizarCorreo, correoEsCanonico } from './correo';

/**
 * Dos defectos reales dieron origen a esto, y los dos se veían igual desde la
 * aplicación: «Credenciales inválidas», indistinguible de equivocarse de
 * contraseña.
 */
describe('Correo · forma canónica', () => {
  it('pasa a minúsculas: el teclado del teléfono capitaliza la primera letra', () => {
    expect(normalizarCorreo('Ana@demo.bo')).toBe('ana@demo.bo');
    expect(normalizarCorreo('ANA@DEMO.BO')).toBe('ana@demo.bo');
  });

  it('recorta los espacios que deja el autocompletado', () => {
    expect(normalizarCorreo(' ana@demo.bo ')).toBe('ana@demo.bo');
    expect(normalizarCorreo('ana@demo.bo\n')).toBe('ana@demo.bo');
  });

  it('no toca lo que ya está en forma canónica', () => {
    expect(normalizarCorreo('ana@demo.bo')).toBe('ana@demo.bo');
  });

  it('es idempotente: normalizar dos veces da lo mismo', () => {
    const una = normalizarCorreo('  Ana@Demo.BO ');
    expect(normalizarCorreo(una)).toBe(una);
  });

  it('no altera los espacios internos, que invalidan el correo', () => {
    // Recortar solo los extremos: un espacio en medio lo vuelve inválido, y de
    // eso se encarga la validación de formato, no esta función.
    expect(normalizarCorreo(' an a@demo.bo ')).toBe('an a@demo.bo');
  });

  describe('correoEsCanonico', () => {
    it('reconoce la forma canónica', () => {
      expect(correoEsCanonico('ana@demo.bo')).toBe(true);
    });

    it('rechaza mayúsculas y espacios', () => {
      expect(correoEsCanonico('Ana@demo.bo')).toBe(false);
      expect(correoEsCanonico('ana@demo.bo ')).toBe(false);
    });
  });
});
