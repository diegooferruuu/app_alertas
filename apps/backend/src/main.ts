import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase payload limit for images (5MB)
  app.use((req, res, next) => {
    req.on('data', () => {}); // Allow large payloads
    next();
  });
  app.use(require('express').json({ limit: '5mb' }));
  app.use(require('express').urlencoded({ limit: '5mb', extended: true }));

  // Enable CORS
  const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',
  ];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
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
