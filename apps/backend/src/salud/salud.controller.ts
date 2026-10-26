import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Si el servidor está en pie y alcanza la base. Sin sesión: lo consultan el
 * healthcheck de Docker y quien despliega.
 *
 * Toca la base a propósito. Una ruta que responde sin consultarla diría «sano»
 * con Postgres caído, que es justo el fallo que importa detectar.
 *
 * No devuelve nada más: ni versión, ni entorno, ni cuántos datos hay.
 */
@Controller('salud')
export class SaludController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async salud(): Promise<{ ok: true }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException('La base de datos no responde');
    }
    return { ok: true };
  }
}
