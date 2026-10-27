import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { UsersService } from '../users/users.service';
import { CuentasService } from '../users/cuentas.service';

/**
 * Elimina una cuenta a pedido de su dueño, por correo, sin la aplicación.
 *
 * Lo corre quien opera el servidor, por `deploy/eliminar-cuenta.sh`, después de
 * comprobar que el pedido llegó **desde el correo de la cuenta**: es lo único
 * que prueba que lo pide su dueño. Hace lo mismo que el botón de la app.
 *
 *   node dist/cli/eliminar-cuenta.js persona@correo.com
 */
async function main(): Promise<void> {
  const correo = process.argv[2]?.trim();
  if (!correo) {
    console.error('Uso: node dist/cli/eliminar-cuenta.js <correo de la cuenta>');
    process.exitCode = 2;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const cuenta = await app.get(UsersService).findByEmail(correo);
    if (!cuenta || cuenta.deleted_at) {
      console.error(`No hay ninguna cuenta activa con el correo ${correo}.`);
      process.exitCode = 1;
      return;
    }
    await app.get(CuentasService).eliminarPorPedido(cuenta.id);
    console.log(`Cuenta de ${correo} eliminada. Confírmalo a esa dirección.`);
  } finally {
    await app.close();
  }
}

void main();
