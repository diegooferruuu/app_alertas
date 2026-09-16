import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

/** Error de `http-errors`, que es lo que lanzan los middlewares de Express. */
interface ErrorDeMiddleware extends Error {
  status?: number;
  statusCode?: number;
}

/**
 * Un código de estado propio y en el rango de los errores del cliente es lo que
 * distingue a estos errores de un fallo cualquiera del servidor. Se comprueba el
 * rango y no solo la presencia del campo: un error interno que por casualidad
 * traiga un `status` no debe convertirse en una respuesta 4xx.
 */
const esErrorDeMiddleware = (e: unknown): e is ErrorDeMiddleware => {
  if (!(e instanceof Error)) return false;
  const codigo = (e as ErrorDeMiddleware).status ?? (e as ErrorDeMiddleware).statusCode;
  return typeof codigo === 'number' && codigo >= 400 && codigo < 500;
};

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        error = (exceptionResponse as any).error || 'Error';
      } else {
        message = exception.message;
      }
    } else if (esErrorDeMiddleware(exception)) {
      // Los middlewares de Express —body-parser, entre otros— lanzan errores de
      // `http-errors`, que llevan su propio código de estado pero no son
      // `HttpException` de Nest. Sin esta rama, un cuerpo demasiado grande se
      // devolvía como 500 «Internal server error»: el cliente no podía
      // distinguir «mandaste demasiado» de «el servidor se rompió», y quien
      // depurara buscaría un fallo del servidor que no existe.
      status = exception.status ?? exception.statusCode!;
      message = exception.message;
      error = exception.name;
      this.logger.warn(`${exception.name}: ${exception.message}`);
    } else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(exception.stack);
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
      message,
      error,
    });
  }
}
