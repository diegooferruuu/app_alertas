import { ModuleMetadata } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { denunciasConfig } from '../../src/config/denuncias.config';
import { esTablaDeDominio, testDataSourceOptions } from './test-datasource';

export interface ContextoDePruebas {
  module: TestingModule;
  dataSource: DataSource;
  /** Vacía las tablas de dominio. Llamar en beforeEach para aislar los casos. */
  limpiar: () => Promise<void>;
  cerrar: () => Promise<void>;
}

/**
 * Levanta un módulo de Nest contra la base de pruebas real.
 *
 * Se piden las piezas concretas que la prueba necesita en lugar de importar los
 * módulos completos: así no arrastra el planificador de caducidad, que al
 * iniciarse registra un intervalo y dejaría temporizadores vivos al terminar la
 * suite. Lo que se ejercita aquí es el comportamiento contra Postgres —
 * restricciones, columnas generadas, consultas geográficas—, no el arranque de
 * la aplicación.
 */
export async function crearContexto(
  metadata: Pick<ModuleMetadata, 'imports' | 'providers'>,
): Promise<ContextoDePruebas> {
  const module = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, load: [denunciasConfig] }),
      TypeOrmModule.forRoot(testDataSourceOptions),
      ...(metadata.imports ?? []),
    ],
    providers: metadata.providers ?? [],
  }).compile();

  const dataSource = module.get(DataSource);

  const limpiar = async () => {
    const tablas: Array<{ tablename: string }> = await dataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
    );
    const objetivo = tablas
      .map((t) => t.tablename)
      .filter(esTablaDeDominio)
      .map((t) => `"${t}"`);

    if (objetivo.length === 0) return;

    // CASCADE porque hay llaves foráneas entre ellas; RESTART IDENTITY para que
    // cada caso vea los mismos identificadores de secuencia.
    await dataSource.query(
      `TRUNCATE TABLE ${objetivo.join(', ')} RESTART IDENTITY CASCADE`,
    );
  };

  return {
    module,
    dataSource,
    limpiar,
    cerrar: async () => {
      await module.close();
    },
  };
}
