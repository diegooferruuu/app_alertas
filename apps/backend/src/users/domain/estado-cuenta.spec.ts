import { EstadoCuenta, puedeCrearDenuncia, estaSuspendida } from './estado-cuenta';

describe('puedeCrearDenuncia', () => {
  const ahora = new Date('2026-09-03T12:00:00Z');
  const enUnaHora = new Date('2026-09-03T13:00:00Z');
  const haceUnaHora = new Date('2026-09-03T11:00:00Z');

  it('una cuenta activa puede', () => {
    expect(puedeCrearDenuncia(EstadoCuenta.ACTIVA, null, ahora)).toBe(true);
  });

  it('una cuenta suspendida no puede, con o sin plazo', () => {
    expect(puedeCrearDenuncia(EstadoCuenta.SUSPENDIDA, null, ahora)).toBe(false);
    expect(puedeCrearDenuncia(EstadoCuenta.SUSPENDIDA, haceUnaHora, ahora)).toBe(
      false,
    );
  });

  it('una restricción vigente impide crear', () => {
    expect(puedeCrearDenuncia(EstadoCuenta.RESTRINGIDA, enUnaHora, ahora)).toBe(
      false,
    );
  });

  it('una restricción ya vencida se levanta sola: vuelve a poder', () => {
    // Sin proceso que le cambie el estado; lo decide el plazo, no la etiqueta.
    expect(
      puedeCrearDenuncia(EstadoCuenta.RESTRINGIDA, haceUnaHora, ahora),
    ).toBe(true);
  });

  it('una restricción sin plazo no bloquea: nada que hacer cumplir', () => {
    expect(puedeCrearDenuncia(EstadoCuenta.RESTRINGIDA, null, ahora)).toBe(true);
  });
});

describe('estaSuspendida', () => {
  it('solo es cierto para SUSPENDIDA', () => {
    expect(estaSuspendida(EstadoCuenta.SUSPENDIDA)).toBe(true);
    expect(estaSuspendida(EstadoCuenta.RESTRINGIDA)).toBe(false);
    expect(estaSuspendida(EstadoCuenta.ACTIVA)).toBe(false);
  });
});
