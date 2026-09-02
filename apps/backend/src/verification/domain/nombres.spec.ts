import {
  nombreConsistenteConDocumento,
  nombreEscritoCoincide,
  normalizarNombre,
  partesSignificativas,
} from './nombres';

describe('Comparación de nombres', () => {
  describe('normalización', () => {
    it('ignora mayúsculas, tildes y espacios de más', () => {
      expect(normalizarNombre('  JUAN   Pérez  LÓPEZ ')).toBe('juan perez lopez');
    });

    it('pliega la eñe a n, porque el OCR la confunde y cuesta teclearla', () => {
      expect(normalizarNombre('Muñoz')).toBe('munoz');
      // Y por lo tanto ambas grafías se aceptan como el mismo apellido.
      expect(nombreEscritoCoincide('Munoz Peña', 'Muñoz Pena')).toBe(true);
    });
  });

  describe('partes significativas', () => {
    it('descarta preposiciones y artículos, que aparecen en cualquier texto', () => {
      expect(partesSignificativas('María de la Cruz Villarroel')).toEqual([
        'maria',
        'cruz',
        'villarroel',
      ]);
    });
  });

  describe('consistencia con el documento', () => {
    const CARNET = `ESTADO PLURINACIONAL DE BOLIVIA
      CEDULA DE IDENTIDAD
      MARIA FERNANDA VILLARROEL QUISPE
      No 9876543 LP`;

    it('acepta un nombre que aparece completo en el documento', () => {
      expect(
        nombreConsistenteConDocumento('María Fernanda Villarroel Quispe', CARNET)
          .coincide,
      ).toBe(true);
    });

    it('tolera que el OCR estropee una palabra suelta', () => {
      const conRuido = CARNET.replace('FERNANDA', 'FERN4NDA');
      expect(
        nombreConsistenteConDocumento('María Fernanda Villarroel Quispe', conRuido)
          .coincide,
      ).toBe(true);
    });

    it('rechaza cuando solo coincide una parte del nombre', () => {
      // Antes bastaba una coincidencia: «María» sola habría pasado, y aparece
      // en incontables documentos.
      const resultado = nombreConsistenteConDocumento(
        'María Gonzales Antezana',
        CARNET,
      );
      expect(resultado.coincide).toBe(false);
      expect(resultado.motivo).toContain('hacen falta 2');
    });

    it('rechaza un nombre sin ninguna relación con el documento', () => {
      expect(
        nombreConsistenteConDocumento('Pedro Ramírez Cortez', CARNET).coincide,
      ).toBe(false);
    });

    it('con un solo nombre comparable, exige ese', () => {
      expect(nombreConsistenteConDocumento('Villarroel', CARNET).coincide).toBe(
        true,
      );
      expect(nombreConsistenteConDocumento('Antezana', CARNET).coincide).toBe(
        false,
      );
    });

    it('rechaza un nombre sin partes comparables', () => {
      const resultado = nombreConsistenteConDocumento('de la', CARNET);
      expect(resultado.coincide).toBe(false);
      expect(resultado.motivo).toContain('ninguna parte comparable');
    });
  });

  describe('firma escrita a mano', () => {
    const REGISTRADO = 'María Fernanda Villarroel Quispe';

    it('acepta el mismo nombre escrito sin tildes', () => {
      expect(
        nombreEscritoCoincide('Maria Fernanda Villarroel Quispe', REGISTRADO),
      ).toBe(true);
    });

    it('acepta mayúsculas y espacios de más', () => {
      expect(
        nombreEscritoCoincide('  MARÍA  FERNANDA   VILLARROEL QUISPE ', REGISTRADO),
      ).toBe(true);
    });

    it('rechaza un nombre incompleto: la firma es del nombre entero', () => {
      expect(nombreEscritoCoincide('María Villarroel', REGISTRADO)).toBe(false);
    });

    it('rechaza el orden alterado: no es el mismo nombre', () => {
      expect(
        nombreEscritoCoincide('Quispe Villarroel Fernanda María', REGISTRADO),
      ).toBe(false);
    });

    it('rechaza un campo vacío', () => {
      expect(nombreEscritoCoincide('   ', REGISTRADO)).toBe(false);
    });
  });
});
