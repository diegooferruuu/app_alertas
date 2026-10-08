import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import { AvistamientosController } from './avistamientos.controller';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/**
 * Lo que recibe cada ruta, leído de los metadatos de Nest.
 *
 * Las claves son `«tipo»:«posición»` para los decoradores propios del
 * framework (`@Req`, `@Body`, ...) y llevan `__customRouteArgs__` para los
 * decoradores creados con `createParamDecorator`, como `@CurrentUser`.
 */
const argumentosDe = (metodo: keyof AvistamientosController): string[] =>
  Object.keys(Reflect.getMetadata(ROUTE_ARGS_METADATA, AvistamientosController, metodo) ?? {});

describe('AvistamientosController', () => {
  it.each(['registrarUso', 'contacto'] as const)(
    '«%s» no recibe al usuario: no hay forma de que llegue a la base ni al registro (I2)',
    (metodo) => {
      const argumentos = argumentosDe(metodo);

      expect(argumentos.some((clave) => clave.includes('__customRouteArgs__'))).toBe(false);
      expect(argumentos.some((clave) => clave.startsWith(`${RouteParamtypes.REQUEST}:`))).toBe(
        false,
      );
    },
  );

  it('la prueba sí detecta un usuario si alguien lo agrega', () => {
    // Sin esto, las de arriba pasarían también si los metadatos no existieran.
    class ConUsuario {
      registrarUso(_usuario: unknown) {}
    }
    CurrentUser()(ConUsuario.prototype, 'registrarUso', 0);

    const argumentos = Object.keys(
      Reflect.getMetadata(ROUTE_ARGS_METADATA, ConUsuario, 'registrarUso') ?? {},
    );
    expect(argumentos.some((clave) => clave.includes('__customRouteArgs__'))).toBe(true);
  });
});
