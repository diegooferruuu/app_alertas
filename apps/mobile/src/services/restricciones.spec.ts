import { describe, expect, it } from '@jest/globals';
import { rechazoDe } from './restricciones';

const POR_DEFECTO = { titulo: 'No se pudo', mensaje: 'Intenta de nuevo.' };
const respuesta = (data: unknown) => ({ response: { data } });

describe('rechazoDe', () => {
  it('con código, titula según la restricción y respeta el mensaje del servidor', () => {
    const rechazo = rechazoDe(
      respuesta({ codigo: 'CUENTA_SUSPENDIDA', message: 'Tu cuenta está suspendida.' }),
      POR_DEFECTO,
    );

    expect(rechazo).toEqual({
      titulo: 'Cuenta suspendida',
      mensaje: 'Tu cuenta está suspendida.',
      codigo: 'CUENTA_SUSPENDIDA',
    });
  });

  it('un código que la app no conoce no se trata como restricción', () => {
    // Un servidor más nuevo puede mandar códigos que esta versión no sabe
    // explicar: se muestra su mensaje con el título genérico.
    const rechazo = rechazoDe(respuesta({ codigo: 'OTRO', message: 'Algo' }), POR_DEFECTO);

    expect(rechazo).toEqual({ titulo: 'No se pudo', mensaje: 'Algo' });
  });

  it('une los mensajes de validación, que llegan como lista', () => {
    const rechazo = rechazoDe(respuesta({ message: ['Falta el nombre', 'Falta la foto'] }), POR_DEFECTO);

    expect(rechazo.mensaje).toBe('Falta el nombre\nFalta la foto');
  });

  it('sin respuesta del servidor usa el texto por defecto', () => {
    expect(rechazoDe(new Error('Network Error'), POR_DEFECTO)).toEqual(POR_DEFECTO);
    expect(rechazoDe(undefined, POR_DEFECTO)).toEqual(POR_DEFECTO);
  });
});
