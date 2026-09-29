import { DataSource, DataSourceOptions } from 'typeorm';
import { config as loadEnv } from 'dotenv';
import { join } from 'path';

// El CLI de TypeORM corre fuera de Nest, así que carga el .env por su cuenta.
// Mismo archivo que usa ConfigModule en app.module.ts (raíz del monorepo).
loadEnv({ path: join(__dirname, '..', '..', '..', '..', '.env') });

/**
 * Opciones compartidas entre el CLI de migraciones y la app.
 *
 * `synchronize` está deliberadamente ausente: nunca debe activarse. El esquema
 * se cambia solo por migraciones versionadas, para que un cambio de entidad no
 * altere la base sin dejar rastro.
 */
// Bajo ts-node se globean fuentes .ts; compilado, los .js de dist.
// Sin esto, un .js viejo junto a su .ts se carga por duplicado y rompe el CLI.
const ext = __filename.endsWith('.ts') ? 'ts' : 'js';

export const baseDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: [join(__dirname, '..', '**', `*.entity.${ext}`)],
  migrations: [join(__dirname, 'migrations', `*.${ext}`)],
  migrationsTableName: 'migrations',
};

// Export por defecto: es lo que consume `typeorm-ts-node-commonjs -d`.
export default new DataSource(baseDataSourceOptions);
