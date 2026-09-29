import {
  UMBRAL_DISTANCIA,
  esConsistente,
  MENSAJES,
  LIMITES_COMPARACION,
} from './comparacion-facial';

/**
 * La decisión, aparte del modelo.
 *
 * Aquí no se ejecuta inferencia: se fija qué hace el sistema con una distancia,
 * que es lo único que puede razonarse sin un conjunto de datos etiquetado.
 */
describe('Comparación facial · decisión', () => {
  describe('umbral', () => {
    it('acepta una distancia por debajo del umbral', () => {
      expect(esConsistente(0.31)).toBe(true);
    });

    it('acepta exactamente el umbral: es el último valor aceptable', () => {
      expect(esConsistente(UMBRAL_DISTANCIA)).toBe(true);
    });

    it('rechaza apenas por encima', () => {
      expect(esConsistente(UMBRAL_DISTANCIA + 0.0001)).toBe(false);
    });

    it('es más estricto que el umbral publicado del modelo', () => {
      // Se midió un par de personas distintas a 0.5979: con el 0.6 publicado
      // habría pasado. El umbral propio tiene que quedar por debajo de eso.
      expect(UMBRAL_DISTANCIA).toBeLessThan(0.6);
      expect(esConsistente(0.5979)).toBe(false);
    });

    it('deja pasar la peor degradación legítima que se midió', () => {
      // Mismo rostro rotado 8 grados: 0.3099. Si el umbral bajara de ahí, el
      // sistema rechazaría a gente por haber inclinado la cámara.
      expect(esConsistente(0.3099)).toBe(true);
    });
  });

  describe('mensajes', () => {
    it('distingue no encontrar un rostro de que los rostros no coincidan', () => {
      // No es cosmético: uno se arregla tomando otra foto y el otro no. Con el
      // mismo mensaje, alguien con una foto borrosa creería que se le acusa de
      // suplantar a otra persona.
      const textos = [
        MENSAJES.sin_rostro_en_documento,
        MENSAJES.sin_rostro_en_selfie,
        MENSAJES.no_coincide,
      ];
      expect(new Set(textos).size).toBe(3);
    });

    it('ninguno afirma que la identidad quedó verificada', () => {
      // El proyecto prohíbe decir «verificado» o «validado»: el sistema no
      // autentica a nadie, y la interfaz no puede prometer lo que no hace.
      const todo = Object.values(MENSAJES).join(' ').toLowerCase();
      expect(todo).not.toMatch(/verificad|validad|autenticad|confirmamos tu identidad/);
    });

    it('los que piden otra foto dicen cómo mejorarla', () => {
      expect(MENSAJES.sin_rostro_en_documento).toMatch(/luz|reflejo/i);
      expect(MENSAJES.sin_rostro_en_selfie).toMatch(/luz|cámara/i);
    });
  });

  describe('límites declarados', () => {
    it('nombra la ausencia de detección de vivacidad', () => {
      // Es la limitación más seria y la más fácil de olvidar al presentar el
      // trabajo: sin ella, una foto impresa frente a la cámara pasa igual.
      expect(LIMITES_COMPARACION.join(' ')).toMatch(/vivacidad/i);
    });

    it('admite que el umbral no está calibrado con datos etiquetados', () => {
      expect(LIMITES_COMPARACION.join(' ')).toMatch(/no.*calibraci|desconocid/i);
    });
  });
});
