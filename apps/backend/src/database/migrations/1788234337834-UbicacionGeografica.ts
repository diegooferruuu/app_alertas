import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * §9: `ST_DWithin` debe poder usar índice.
 *
 * Hasta aquí la consulta por cercanía construía el punto con
 * `ST_SetSRID(ST_MakePoint(...))::geography` fila por fila, lo que impide usar
 * cualquier índice y obliga a recorrer la tabla entera.
 *
 * La columna es GENERATED ALWAYS ... STORED: Postgres la calcula a partir de
 * latitude/longitude, así que no puede quedar desincronizada ni requiere que el
 * código la escriba. Las filas existentes se rellenan solas al crearla.
 */
export class UbicacionGeografica1788234337834 implements MigrationInterface {
  name = 'UbicacionGeografica1788234337834';

  /** Expresión de la columna generada. Debe coincidir con la de la entidad. */
  private static readonly EXPRESION =
    'ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "incidents"
      ADD COLUMN "ubicacion" geography(Point,4326)
      GENERATED ALWAYS AS (${UbicacionGeografica1788234337834.EXPRESION}) STORED
      NOT NULL
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_incidents_ubicacion" ON "incidents" USING GiST ("ubicacion")`,
    );

    // TypeORM guarda la expresión de las columnas generadas en esta tabla. Sin
    // el registro cree que la columna es normal y cada `migration:generate`
    // propondría recrearla.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "typeorm_metadata" (
        "type" varchar NOT NULL,
        "database" varchar,
        "schema" varchar,
        "table" varchar,
        "name" varchar,
        "value" text
      )
    `);
    await queryRunner.query(
      `INSERT INTO "typeorm_metadata"("database", "schema", "table", "type", "name", "value")
       VALUES (current_database(), 'public', 'incidents', 'GENERATED_COLUMN', 'ubicacion', $1)`,
      [UbicacionGeografica1788234337834.EXPRESION],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "typeorm_metadata"
       WHERE "type" = 'GENERATED_COLUMN' AND "name" = 'ubicacion' AND "table" = 'incidents'`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_incidents_ubicacion"`);
    await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "ubicacion"`);
  }
}
