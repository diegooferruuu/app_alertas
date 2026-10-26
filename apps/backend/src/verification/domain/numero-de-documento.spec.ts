import { compararNumeroDelCarnet, leerNumeroDelCarnet } from './numero-de-documento';

/** Así llega, más o menos, el texto del anverso de un carnet nuevo. */
const CARNET_CON_COMPLEMENTO = `ESTADO PLURINACIONAL DE BOLIVIA
CEDULA DE IDENTIDAD
SERIE SECCION
NOMBRES ROSA
APELLIDOS VARGAS
FECHA DE EMISION 01/11/2023 FECHA DE EXPIRACION 01/11/2028
12345678-1K`;

describe('Número del carnet', () => {
  describe('leerNumeroDelCarnet', () => {
    it('encuentra el número y lee el complemento pegado con guion', () => {
      expect(leerNumeroDelCarnet(CARNET_CON_COMPLEMENTO, '12345678')).toEqual({
        aparece: true,
        complemento: '1K',
      });
    });

    it('no acepta un número que solo es un trozo de otro', () => {
      // Antes bastaba con que apareciera dentro de la tira de todos los dígitos.
      expect(leerNumeroDelCarnet('912345678', '12345678').aparece).toBe(false);
      expect(leerNumeroDelCarnet('123456789', '12345678').aparece).toBe(false);
      // Ni uno armado con las fechas, pegadas al quitar las barras.
      expect(leerNumeroDelCarnet(CARNET_CON_COMPLEMENTO, '1112023').aparece).toBe(false);
    });

    it('sin guion no adivina un complemento: el lugar de expedición no lo es', () => {
      expect(leerNumeroDelCarnet('C.I. 1234567 LP', '1234567')).toEqual({
        aparece: true,
        complemento: null,
      });
      expect(leerNumeroDelCarnet('1234567 01/11/2023', '1234567').complemento).toBeNull();
    });

    it('tolera un espacio que el OCR mete entre dígitos y el guion largo', () => {
      expect(leerNumeroDelCarnet('1234 5678 – 1K', '12345678')).toEqual({
        aparece: true,
        complemento: '1K',
      });
    });

    it('si el número aparece dos veces, se queda con la que trae complemento', () => {
      expect(leerNumeroDelCarnet('12345678\n12345678-2A', '12345678').complemento).toBe('2A');
    });
  });

  describe('compararNumeroDelCarnet', () => {
    it('coincide cuando el número y el complemento son los del carnet', () => {
      expect(compararNumeroDelCarnet(CARNET_CON_COMPLEMENTO, '12345678', '1k')).toEqual({
        coincide: true,
      });
      expect(compararNumeroDelCarnet('C.I. 1234567', '1234567', undefined)).toEqual({
        coincide: true,
      });
    });

    it('rechaza registrarse con el número solo si el carnet muestra complemento', () => {
      // Es el agujero que cierra: el número solo identifica a otra persona.
      expect(compararNumeroDelCarnet(CARNET_CON_COMPLEMENTO, '12345678', undefined)).toMatchObject({
        coincide: false,
        motivo: expect.stringContaining('complemento 1K'),
      });
    });

    it('rechaza un complemento declarado que el carnet no muestra', () => {
      expect(compararNumeroDelCarnet('C.I. 1234567', '1234567', '1K')).toMatchObject({
        coincide: false,
        motivo: expect.stringContaining('deja ese campo vacío'),
      });
    });

    it('rechaza un complemento distinto del impreso', () => {
      expect(compararNumeroDelCarnet(CARNET_CON_COMPLEMENTO, '12345678', '2K').coincide).toBe(
        false,
      );
    });

    it('tolera que el OCR lea una I por un 1 o una O por un 0', () => {
      expect(compararNumeroDelCarnet('12345678-IK', '12345678', '1K').coincide).toBe(true);
      expect(compararNumeroDelCarnet('12345678-O2', '12345678', '02').coincide).toBe(true);
    });

    it('si el número no aparece, lo dice antes que nada', () => {
      const resultado = compararNumeroDelCarnet(CARNET_CON_COMPLEMENTO, '7654321', '1K');

      expect(resultado).toEqual({
        coincide: false,
        motivo: 'el número 7654321 no aparece en el documento',
      });
    });
  });
});
