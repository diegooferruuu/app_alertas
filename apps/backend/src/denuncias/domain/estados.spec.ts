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

    it('solo hay dos niveles: firmar es la única subida', () => {
      // Hubo un tercero, CORROBORADA, con el caso de la FELCC; se quitó porque
      // el sistema no podía comprobar ese número.
      expect(Object.values(NivelConfianza)).toEqual([
        NivelConfianza.REGISTRADA,
        NivelConfianza.PROVISIONAL,
      ]);
    });

    it('nunca baja: una declaración firmada no se retira', () => {
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

    it('una caducada puede reactivarse al prolongarla: caduca la alerta, no el caso', () => {
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

    it('se difunde una vez firmada', () => {
      expect(esDifundible(NivelConfianza.PROVISIONAL, EstadoDenuncia.ACTIVA)).toBe(
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
