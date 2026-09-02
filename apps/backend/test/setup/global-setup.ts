import { DataSource, DataSourceOptions } from 'typeorm';
import { TEST_DB_NAME, testDataSourceOptions } from './test-datasource';

/**
 * Prepara la base de pruebas una sola vez, antes de toda la suite.
 *
 * Crea la base si no existe y aplica las migraciones. Aplicarlas —en lugar de
 * dejar que TypeORM sincronice el esquema desde las entidades— hace que cada
 * ejecución compruebe de paso que las migraciones producen el esquema que el
 * código espera. Es la misma verificación que haríamos a mano antes de un
 * despliegue, solo que automática.
 */
export default async function globalSetup(): Promise<void> {
  // El cast es necesario porque al sobrescribir `database` TypeScript pierde
  // la rama postgres de la unión de opciones y la ensancha a todos los motores.
  const admin = new DataSource({
    ...testDataSourceOptions,
    database: 'postgres',
  } as DataSourceOptions);

  await admin.initialize();
  try {
    const existe = await admin.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [TEST_DB_NAME],
    );
    if (existe.length === 0) {
      // El nombre viene de configuración, no de una petición, pero igualmente
      // se valida: un identificador no admite parámetros preparados.
      if (!/^[A-Za-z0-9_]+$/.test(TEST_DB_NAME)) {
        throw new Error(`Nombre de base de pruebas inválido: ${TEST_DB_NAME}`);
      }
      await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
    }
  } finally {
    await admin.destroy();
  }

  const dataSource = new DataSource(testDataSourceOptions);
  await dataSource.initialize();
  try {
    await dataSource.runMigrations();
  } finally {
    await dataSource.destroy();
  }
}
