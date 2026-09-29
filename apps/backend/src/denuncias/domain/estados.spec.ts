import {
  EstadoDenuncia,
  NivelConfianza,
  esDifundible,
  puedeTransicionarEstado,
  puedeTransicionarNivel,
} from './estados';

/**
 * La máquina de estados es donde se sostiene el invariante I1 —crear y difundir
 * son operaciones distintas—, así que cada transición tiene su prueba, incluidas
 * las prohibidas: son las que un refactor posterior rompe sin darse cuenta.
 */
describe('Máquina de estados de una denuncia', () => {
  describe('nivel de confianza', () => {
    it('sube de REGISTRADA a PROVISIONAL al firmar la declaración', () => {
      expect(
        puedeTransicionarNivel(NivelConfianza.REGISTRADA, NivelConfianza.PROVISIONAL),
      ).toBe(true);
    });

    it('sube de PROVISIONAL a CORROBORADA con respaldo', () => {
      expect(
        puedeTransicionarNivel(NivelConfianza.PROVISIONAL, NivelConfianza.CORROBORADA),
      ).toBe(true);
    });

    it('no salta de REGISTRADA directo a CORROBORADA, sin pasar por la firma', () => {
      expect(
        puedeTransicionarNivel(NivelConfianza.REGISTRADA, NivelConfianza.CORROBORADA),
      ).toBe(false);
    });

    it('nunca baja: una corroboración quedó sellada y no se puede retirar', () => {
      expect(
        puedeTransicionarNivel(NivelConfianza.CORROBORADA, NivelConfianza.PROVISIONAL),
      ).toBe(false);
      expect(
        puedeTransicionarNivel(NivelConfianza.PROVISIONAL, NivelConfianza.REGISTRADA),
      ).toBe(false);
    });

    it('no transiciona a sí mismo', () => {
      for (const nivel of Object.values(NivelConfianza)) {
        expect(puedeTransicionarNivel(nivel, nivel)).toBe(false);
      }
    });
  });

  describe('estado', () => {
    it('una denuncia activa puede caducar, invalidarse o cerrarse', () => {
      expect(
        puedeTransicionarEstado(EstadoDenuncia.ACTIVA, EstadoDenuncia.CADUCADA),
      ).toBe(true);
      expect(
        puedeTransicionarEstado(EstadoDenuncia.ACTIVA, EstadoDenuncia.INVALIDADA),
      ).toBe(true);
      expect(
        puedeTransicionarEstado(EstadoDenuncia.ACTIVA, EstadoDenuncia.CERRADA),
      ).toBe(true);
    });

    it('una caducada puede reactivarse: caduca la alerta, no el caso', () => {
      expect(
        puedeTransicionarEstado(EstadoDenuncia.CADUCADA, EstadoDenuncia.ACTIVA),
      ).toBe(true);
    });

    it('una invalidada no se reactiva por ninguna vía', () => {
      for (const destino of Object.values(EstadoDenuncia)) {
        expect(puedeTransicionarEstado(EstadoDenuncia.INVALIDADA, destino)).toBe(
          false,
        );
      }
    });

    it('una cerrada es terminal', () => {
      for (const destino of Object.values(EstadoDenuncia)) {
        expect(puedeTransicionarEstado(EstadoDenuncia.CERRADA, destino)).toBe(false);
      }
    });
  });

  describe('difusión', () => {
    it('una denuncia REGISTRADA no se difunde, aunque esté activa', () => {
      expect(esDifundible(NivelConfianza.REGISTRADA, EstadoDenuncia.ACTIVA)).toBe(
        false,
      );
    });

    it('se difunde desde PROVISIONAL, y también CORROBORADA', () => {
      expect(esDifundible(NivelConfianza.PROVISIONAL, EstadoDenuncia.ACTIVA)).toBe(
        true,
      );
      expect(esDifundible(NivelConfianza.CORROBORADA, EstadoDenuncia.ACTIVA)).toBe(
        true,
      );
    });

    it('ningún nivel se difunde si la denuncia no está activa', () => {
      const noActivos = [
        EstadoDenuncia.CADUCADA,
        EstadoDenuncia.INVALIDADA,
        EstadoDenuncia.CERRADA,
      ];
      for (const estado of noActivos) {
        for (const nivel of Object.values(NivelConfianza)) {
          expect(esDifundible(nivel, estado)).toBe(false);
        }
      }
    });
  });
});
