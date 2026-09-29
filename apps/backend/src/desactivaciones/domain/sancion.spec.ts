import { sancionPor } from './sancion';
import { EstadoCuenta } from '../../users/domain/estado-cuenta';

describe('sancionPor', () => {
  it('la primera desactivación restringe, no suspende', () => {
    const s = sancionPor(1, 1);
    expect(s.estado).toBe(EstadoCuenta.RESTRINGIDA);
    expect(s.razon).toBe('primera_desactivacion');
    expect(s.bloquearDocumento).toBe(false);
  });

  it('la segunda desactivación de cualquier caso suspende y bloquea el documento', () => {
    // Dos casos distintos: dirigidas se queda en 1, recibidas llega a 2.
    const s = sancionPor(2, 1);
    expect(s.estado).toBe(EstadoCuenta.SUSPENDIDA);
    expect(s.razon).toBe('segunda_desactivacion');
    expect(s.bloquearDocumento).toBe(true);
  });

  it('dos desactivaciones contra la misma persona suspenden por reincidencia dirigida', () => {
    const s = sancionPor(2, 2);
    expect(s.estado).toBe(EstadoCuenta.SUSPENDIDA);
    expect(s.razon).toBe('reincidencia_dirigida');
    expect(s.bloquearDocumento).toBe(true);
  });

  it('la reincidencia dirigida se comprueba primero: su razón prevalece', () => {
    // Aunque el recuento general también dispararía la suspensión, importa
    // registrar que fue dirigida — es la señal más fuerte de mala fe.
    expect(sancionPor(3, 2).razon).toBe('reincidencia_dirigida');
  });

  it('a partir de la tercera sigue suspendida: la sanción no se degrada', () => {
    expect(sancionPor(3, 1).estado).toBe(EstadoCuenta.SUSPENDIDA);
    expect(sancionPor(5, 3).estado).toBe(EstadoCuenta.SUSPENDIDA);
  });
});
