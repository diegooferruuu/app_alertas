import { EstadoCuenta, estaSuspendida } from './estado-cuenta';

describe('estaSuspendida', () => {
  it('solo es cierto para SUSPENDIDA', () => {
    expect(estaSuspendida(EstadoCuenta.SUSPENDIDA)).toBe(true);
    expect(estaSuspendida(EstadoCuenta.ACTIVA)).toBe(false);
  });
});
