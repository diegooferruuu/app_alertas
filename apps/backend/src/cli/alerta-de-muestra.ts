import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { AlertaDeMuestra } from '../muestra/alerta-de-muestra';
import { DenunciasService } from '../denuncias/denuncias.service';
import { FirmasService } from '../declaraciones/firmas.service';
import { DeclaracionesService } from '../declaraciones/declaraciones.service';

const QUE_PASO = {
  creada: 'Alerta de muestra presentada y firmada.',
  vigente: 'La alerta de muestra sigue a la vista; no hizo falta tocarla.',
  prolongada: 'Alerta de muestra prolongada, sin notificar a nadie.',
  renovada: 'Se acabaron las prolongaciones: la anterior quedó encontrada y se presentó otra.',
} as const;

/**
 * Mantiene a la vista la alerta de muestra que necesita el revisor de Google
 * Play. Lo corre quien opera el servidor, por `deploy/alerta-de-muestra.sh`, que
 * le pasa la fotografía por la entrada estándar.
 *
 *   node dist/cli/alerta-de-muestra.js < persona-de-ejemplo.jpg
 */
async function main(): Promise<void> {
  const partes: Buffer[] = [];
  for await (const parte of process.stdin) partes.push(parte as Buffer);
  const foto = Buffer.concat(partes);
  // La app muestra las fotos como JPEG: otro formato saldría como un hueco.
  if (foto.length === 0 || foto[0] !== 0xff || foto[1] !== 0xd8 || foto[2] !== 0xff) {
    console.error('Uso: node dist/cli/alerta-de-muestra.js < fotografia.jpg  (un JPEG)');
    process.exitCode = 2;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const muestra = new AlertaDeMuestra(
      app.get(DataSource),
      app.get(DenunciasService),
      app.get(FirmasService),
      app.get(DeclaracionesService),
      app.get(ConfigService)
    );
    const { accion, expiraEn } = await muestra.mantener(foto.toString('base64'));
    console.log(`${QUE_PASO[accion]} Vence el ${expiraEn.toISOString()}.`);
  } finally {
    await app.close();
  }
}

void main();
