import {
  EstadoSancion,
  debeSuspenderse,
  estadoSancion,
  funcionesRestringidas,
} from './situacion';

describe('situación de sanciones', () => {
  describe('estadoSancion', () => {
    it('sin faltas, la cuenta está normal', () => {
      expect(estadoSancion(false, 0)).toBe(EstadoSancion.NORMAL);
    });

    it('con una falta, queda con falta', () => {
      expect(estadoSancion(false, 1)).toBe(EstadoSancion.CON_FALTA);
    });

    it('la suspensión prevalece sobre el recuento de faltas', () => {
      expect(estadoSancion(true, 2)).toBe(EstadoSancion.SUSPENDIDA);
    });
  });

  describe('funcionesRestringidas', () => {
    it('una cuenta normal no tiene restricciones', () => {
      expect(funcionesRestringidas(EstadoSancion.NORMAL)).toEqual([]);
    });

    it('con una falta puede denunciar, pero no difundir sin el caso de la FELCC (I9)', () => {
      const restringidas = funcionesRestringidas(EstadoSancion.CON_FALTA);
      expect(restringidas).toEqual(['DIFUNDIR_SIN_CASO_FELCC']);
      expect(restringidas).not.toContain('DENUNCIAR');
    });

    it('suspendida pierde todo, incluso la recepción de alertas', () => {
      expect(funcionesRestringidas(EstadoSancion.SUSPENDIDA)).toEqual(
        expect.arrayContaining(['DENUNCIAR', 'FIRMAR', 'RECIBIR_ALERTAS']),
      );
    });
  });

  describe('debeSuspenderse', () => {
    it('una sola persona no alcanza para suspender (I9)', () => {
      expect(debeSuspenderse(1, 2)).toBe(false);
    });

    it('dos personas distintas sí', () => {
      expect(debeSuspenderse(2, 2)).toBe(true);
    });
  });
});
