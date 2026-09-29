import { edadEn, esMenorDeEdad, MAYORIA_DE_EDAD } from './minoria-edad';

/**
 * La regla que decide si una alerta puede llevar el retrato de quien busca.
 *
 * Se prueba con fecha de referencia fija y no con `new Date()`: una prueba de
 * límites de edad que dependa del día en que se ejecuta falla sola en algún
 * cumpleaños y nadie entiende por qué.
 */
describe('minoría de edad de la persona buscada', () => {
  const HOY = new Date(2026, 8, 15); // 15 de septiembre de 2026

  describe('edadEn', () => {
    it('cuenta años cumplidos', () => {
      expect(edadEn(new Date(2000, 8, 15), HOY)).toBe(26);
    });

    it('no cuenta el año en curso si el cumpleaños no llegó', () => {
      // Un día antes de cumplir: todavía tiene la edad anterior.
      expect(edadEn(new Date(2000, 8, 16), HOY)).toBe(25);
    });

    it('cuenta el año el mismo día del cumpleaños', () => {
      expect(edadEn(new Date(2008, 8, 15), HOY)).toBe(18);
    });
  });

  describe('esMenorDeEdad', () => {
    it('un niño de diez años lo es', () => {
      expect(esMenorDeEdad('2016-03-04', HOY)).toBe(true);
    });

    it('deja de serlo el día que cumple dieciocho', () => {
      // El límite se cruza el día exacto, no el mes ni el año.
      expect(esMenorDeEdad('2008-09-15', HOY)).toBe(false);
      expect(esMenorDeEdad('2008-09-16', HOY)).toBe(true);
    });

    it('un adulto no lo es', () => {
      expect(esMenorDeEdad('1990-01-01', HOY)).toBe(false);
    });

    it('se mide contra hoy, no contra cuándo desapareció', () => {
      // Quien desapareció siendo menor y ya cumplió dieciocho deja de necesitar
      // esta protección: lo que se protege es a quien la alerta expone ahora.
      const naceEn2008 = '2008-01-10';
      expect(esMenorDeEdad(naceEn2008, new Date(2025, 0, 1))).toBe(true);
      expect(esMenorDeEdad(naceEn2008, HOY)).toBe(false);
    });

    it('una fecha ausente no es menor', () => {
      // Si lo fuera, omitir la fecha sería la forma de saltarse la
      // obligatoriedad de la fotografía.
      expect(esMenorDeEdad(null, HOY)).toBe(false);
      expect(esMenorDeEdad(undefined, HOY)).toBe(false);
      expect(esMenorDeEdad('', HOY)).toBe(false);
    });

    it('una fecha ilegible no es menor', () => {
      expect(esMenorDeEdad('no es una fecha', HOY)).toBe(false);
    });

    it('acepta la cadena de la columna `date` y un Date indistintamente', () => {
      expect(esMenorDeEdad('2015-06-20', HOY)).toBe(
        esMenorDeEdad(new Date(2015, 5, 20), HOY),
      );
    });

    it('no corre la fecha un día por la zona horaria', () => {
      // `new Date('2008-09-15')` se lee como medianoche UTC, que en Bolivia
      // (UTC−4) es el día 14. En el límite exacto eso invertiría el resultado:
      // quien cumple dieciocho hoy figuraría como menor.
      expect(esMenorDeEdad('2008-09-15', HOY)).toBe(false);
    });

    it('el umbral es el declarado, no un número suelto', () => {
      const referencia = new Date(2026, 0, 1);
      const justoEnElUmbral = new Date(
        referencia.getFullYear() - MAYORIA_DE_EDAD,
        referencia.getMonth(),
        referencia.getDate(),
      );
      expect(esMenorDeEdad(justoEnElUmbral, referencia)).toBe(false);
    });
  });
});
