import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * §12.1 — La tabla y sus columnas pasan a llamarse como el dominio.
 *
 * El sistema no denomina víctima a la persona buscada: no toda desaparición
 * supone un delito, y nombrarla así prejuzgaría el caso. Estos son además los
 * nombres que aparecen en el modelo entidad-relación del documento de grado.
 *
 * Se eliminan dos columnas:
 *  - `category`: el sistema atiende un único tipo de caso.
 *  - `confirmations_count`: la cuenta se derivará de las declaraciones juradas
 *    de tipo corroboración, así que un contador aparte sería un dato duplicado
 *    que puede quedar desincronizado.
 *
 * Todo por RENAME, nunca DROP + ADD: renombrar conserva los datos.
 */
export class RenombrarDenuncias1788301900492 implements MigrationInterface {
  name = 'RenombrarDenuncias1788301900492';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Índices y restricciones acompañan a la tabla, pero sus nombres no: se
    // renombran aparte para que el esquema quede legible.
    await queryRunner.query(`ALTER TABLE "incidents" RENAME TO "denuncias"`);
    await queryRunner.query(
      `ALTER TABLE "denuncias" RENAME COLUMN "victim_name" TO "nombre_persona_buscada"`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" RENAME COLUMN "reporter_id" TO "denunciante_id"`,
    );

    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "category"`);
    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "confirmations_count"`);

    await queryRunner.query(
      `ALTER INDEX "idx_incidents_created_at" RENAME TO "idx_denuncias_created_at"`,
    );
    await queryRunner.query(
      `ALTER INDEX "idx_incidents_ubicacion" RENAME TO "idx_denuncias_ubicacion"`,
    );

    // TypeORM deriva el nombre de la llave foránea de tabla + columna, así que
    // el renombrado cambia el hash que espera. Sin esto, cada migration:generate
    // propondría recrear la restricción.
    await queryRunner.query(
      `ALTER TABLE "denuncias" RENAME CONSTRAINT "FK_997933e2e9897cd680e453805ca" TO "FK_d2b981ae68b9203fcebca238683"`,
    );

    // TypeORM guarda aquí la expresión de las columnas generadas, referenciando
    // la tabla por nombre. Sin actualizarlo, cada migration:generate propondría
    // recrear la columna `ubicacion`.
    await queryRunner.query(
      `UPDATE "typeorm_metadata" SET "table" = 'denuncias'
       WHERE "table" = 'incidents' AND "type" = 'GENERATED_COLUMN'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "typeorm_metadata" SET "table" = 'incidents'
       WHERE "table" = 'denuncias' AND "type" = 'GENERATED_COLUMN'`,
    );

    await queryRunner.query(
      `ALTER TABLE "denuncias" RENAME CONSTRAINT "FK_d2b981ae68b9203fcebca238683" TO "FK_997933e2e9897cd680e453805ca"`,
    );
    await queryRunner.query(
      `ALTER INDEX "idx_denuncias_ubicacion" RENAME TO "idx_incidents_ubicacion"`,
    );
    await queryRunner.query(
      `ALTER INDEX "idx_denuncias_created_at" RENAME TO "idx_incidents_created_at"`,
    );

    // Las columnas eliminadas vuelven con sus valores por defecto originales.
    // Los datos que contenían no se recuperan: `category` era constante
    // ('desaparicion') y el contador se recalcula desde las corroboraciones.
    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "confirmations_count" integer NOT NULL DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "category" character varying(40) NOT NULL DEFAULT 'desaparicion'`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" ALTER COLUMN "category" DROP DEFAULT`,
    );

    await queryRunner.query(
      `ALTER TABLE "denuncias" RENAME COLUMN "denunciante_id" TO "reporter_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" RENAME COLUMN "nombre_persona_buscada" TO "victim_name"`,
    );
    await queryRunner.query(`ALTER TABLE "denuncias" RENAME TO "incidents"`);
  }
}
