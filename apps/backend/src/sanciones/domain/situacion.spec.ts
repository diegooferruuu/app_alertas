import {
  EstadoSancion,
  debeSuspenderse,
  estadoSancion,
  fechaLegible,
  finDeSuspensionTemporal,
  funcionesRestringidas,
} from './situacion';

const DIA = 24 * 3_600_000;

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

  describe('finDeSuspensionTemporal', () => {
    const ahora = new Date('2026-10-04T12:00:00Z');

    it('dura los días configurados desde la última falta', () => {
      const falta = new Date(ahora.getTime() - 2 * DIA);

      expect(finDeSuspensionTemporal(falta, 7, ahora)).toEqual(
        new Date(falta.getTime() + 7 * DIA),
      );
    });

    it('termina sola: pasados los días, ya no hay suspensión', () => {
      const falta = new Date(ahora.getTime() - 7 * DIA - 1);

      expect(finDeSuspensionTemporal(falta, 7, ahora)).toBeNull();
    });

    it('sin faltas no hay suspensión', () => {
      expect(finDeSuspensionTemporal(null, 7, ahora)).toBeNull();
    });
  });

  describe('funcionesRestringidas', () => {
    const hasta = new Date('2026-10-11T12:00:00Z');

    it('una cuenta normal no tiene restricciones', () => {
      expect(funcionesRestringidas(EstadoSancion.NORMAL, null)).toEqual([]);
    });

    it('con una falta reciente no denuncia, no firma ni prolonga, pero sigue recibiendo alertas (I9)', () => {
      const restringidas = funcionesRestringidas(EstadoSancion.CON_FALTA, hasta);

      expect(restringidas).toEqual(['DENUNCIAR', 'FIRMAR', 'PROLONGAR']);
      expect(restringidas).not.toContain('RECIBIR_ALERTAS');
    });

    it('pasados los días de la falta no pierde nada: la falta solo cuenta para la suspensión', () => {
      expect(funcionesRestringidas(EstadoSancion.CON_FALTA, null)).toEqual([]);
    });

    it('suspendida pierde todo, incluso la recepción de alertas', () => {
      expect(funcionesRestringidas(EstadoSancion.SUSPENDIDA, null)).toEqual(
        expect.arrayContaining(['DENUNCIAR', 'FIRMAR', 'PROLONGAR', 'RECIBIR_ALERTAS']),
      );
    });
  });

  describe('debeSuspenderse', () => {
    it('una sola persona no alcanza para suspender de forma definitiva (I9)', () => {
      expect(debeSuspenderse(1, 2)).toBe(false);
    });

    it('dos personas distintas sí', () => {
      expect(debeSuspenderse(2, 2)).toBe(true);
    });
  });

  describe('fechaLegible', () => {
    it('escribe la fecha en la hora de Bolivia, no en la del servidor', () => {
      // 16:30 UTC son las 12:30 en La Paz (UTC-4, sin horario de verano).
      const texto = fechaLegible(new Date('2026-10-11T16:30:00Z'));

      expect(texto).toContain('11 de octubre de 2026');
      expect(texto).toContain('12:30');
    });
  });
});
