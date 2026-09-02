import { DataSourceOptions } from 'typeorm';
import { baseDataSourceOptions } from '../../src/database/data-source';

/**
 * Base de datos exclusiva de las pruebas de integración.
 *
 * Es una base aparte y no la de desarrollo: las pruebas vacían tablas entre
 * casos, así que apuntarlas a la base de trabajo destruiría los datos con los
 * que se está probando la app a mano.
 */
export const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'app_alertas_test';

// El cast es necesario porque al sobrescribir `database` TypeScript pierde la
// rama postgres de la unión de opciones y la ensancha a todos los motores, uno
// de los cuales espera un Uint8Array en ese campo.
export const testDataSourceOptions = {
  ...baseDataSourceOptions,
  database: TEST_DB_NAME,
  // El esquema lo crean las migraciones, igual que en producción: así las
  // pruebas verifican también que las migraciones sean correctas.
  synchronize: false,
  dropSchema: false,
  logging: false,
} as DataSourceOptions;

/** Tablas que no deben vaciarse entre casos. */
const TABLAS_PRESERVADAS = new Set([
  'migrations', // el registro de qué migraciones se aplicaron
  'typeorm_metadata', // expresiones de columnas generadas
  'spatial_ref_sys', // catálogo de PostGIS
]);

export const esTablaDeDominio = (nombre: string): boolean =>
  !TABLAS_PRESERVADAS.has(nombre);
