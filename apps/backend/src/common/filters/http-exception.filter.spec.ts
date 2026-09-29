import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

/**
 * El filtro traduce cualquier excepción en una respuesta HTTP.
 *
 * Su defecto histórico ha sido el mismo dos veces: dar 500 a errores que traían
 * su propio código. Pasó con las credenciales inválidas —cada login fallido
 * devolvía 500 en vez de 401— y volvió a pasar con los cuerpos demasiado
 * grandes. Estas pruebas fijan las dos familias para que no haya una tercera.
 */
describe('AllExceptionsFilter', () => {
  let filtro: AllExceptionsFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let host: any;

  beforeEach(() => {
    filtro = new AllExceptionsFilter();
    json = jest.fn();
    status = jest.fn(() => ({ json }));
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ url: '/api/prueba' }),
      }),
    };
    jest.spyOn(filtro['logger'], 'error').mockImplementation(() => {});
    jest.spyOn(filtro['logger'], 'warn').mockImplementation(() => {});
  });

  const respuesta = () => json.mock.calls[0][0];

  describe('excepciones de Nest', () => {
    it('conserva el código y el mensaje', () => {
      filtro.catch(new NotFoundException('Denuncia no encontrada'), host);

      expect(status).toHaveBeenCalledWith(404);
      expect(respuesta().message).toBe('Denuncia no encontrada');
    });

    it('conserva la lista de motivos de una validación', () => {
      filtro.catch(
        new BadRequestException(['property x should not exist']),
        host,
      );

      expect(status).toHaveBeenCalledWith(400);
      expect(respuesta().message).toEqual(['property x should not exist']);
    });
  });

  describe('errores de middleware de Express', () => {
    /** Así es un error de `http-errors`, que es lo que lanza body-parser. */
    const errorDeMiddleware = (nombre: string, codigo: number) => {
      const e = new Error('request entity too large') as Error & {
        status: number;
        statusCode: number;
      };
      e.name = nombre;
      e.status = codigo;
      e.statusCode = codigo;
      return e;
    };

    it('un cuerpo demasiado grande devuelve 413, no 500', () => {
      // El defecto real: la aplicación recibía «Internal server error» al subir
      // las fotos del documento y no había forma de distinguir «mandaste
      // demasiado» de «el servidor se rompió».
      filtro.catch(errorDeMiddleware('PayloadTooLargeError', 413), host);

      expect(status).toHaveBeenCalledWith(413);
      expect(respuesta().error).toBe('PayloadTooLargeError');
      expect(respuesta().message).toBe('request entity too large');
    });

    it('también funciona si solo trae statusCode', () => {
      const e = new Error('malformed') as Error & { statusCode: number };
      e.name = 'SyntaxError';
      e.statusCode = 400;

      filtro.catch(e, host);

      expect(status).toHaveBeenCalledWith(400);
    });
  });

  describe('lo que sí es un fallo del servidor', () => {
    it('un error cualquiera sigue devolviendo 500', () => {
      filtro.catch(new Error('se rompió algo'), host);

      expect(status).toHaveBeenCalledWith(500);
    });

    it('un error con código 5xx no se convierte en respuesta de cliente', () => {
      // La comprobación mira el rango, no la mera presencia del campo: un fallo
      // interno que por casualidad traiga `status` no debe disfrazarse de 4xx.
      const e = new Error('upstream caído') as Error & { status: number };
      e.status = 502;

      filtro.catch(e, host);

      expect(status).toHaveBeenCalledWith(500);
    });
  });
});
