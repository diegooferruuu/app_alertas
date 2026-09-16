import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  // El registro de documento manda tres imágenes en base64 —anverso, reverso y
  // selfie— en un solo cuerpo. El límite por defecto de Express son 100 kB.
  //
  // 25 MB es holgura, no la medida esperada: la aplicación reduce cada imagen
  // antes de enviarla y el cuerpo real ronda los 2 MB. El margen existe para que
  // una foto inesperadamente grande dé un error claro en vez de cortarse a
  // mitad, no para tolerar que el cliente mande fotos sin reducir.
  app.useBodyParser('json', { limit: '25mb' });
  app.useBodyParser('urlencoded', { limit: '25mb', extended: true });

  // CORS.
  //
  // Antes había dos direcciones de red local escritas a mano. Envejecieron en
  // silencio: el router reparte otra dirección y el desarrollo dejaba de
  // funcionar sin que nada dijera por qué. Ahora se admite cualquier dirección
  // privada, que es exactamente el caso de uso —un teléfono en la misma red que
  // la máquina de desarrollo— y no depende de qué dirección tocó hoy.
  //
  // La aplicación móvil no envía cabecera `Origin`, así que esto solo afecta al
  // navegador. En producción, detrás de un dominio, la lista debe cerrarse.
  const ORIGEN_LOCAL =
    /^http:\/\/(localhost|127\.0\.0\.1|10\.[0-9.]+|192\.168\.[0-9.]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9.]+)(:\d+)?$/;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || ORIGEN_LOCAL.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  });

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Prefix for API routes
  app.setGlobalPrefix('api');

  const port = process.env.BACKEND_PORT || 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/api`);
}

bootstrap();