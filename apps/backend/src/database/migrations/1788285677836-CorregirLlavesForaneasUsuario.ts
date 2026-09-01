import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige la integridad referencial de refresh_tokens y reputation_events.
 *
 * Sus relaciones @ManyToOne no declaraban @JoinColumn, así que TypeORM creó una
 * columna "userId" propia y colgó de ella la llave foránea — además de la
 * "user_id" ya declarada, que es la que el código escribe. Resultado: la
 * restricción vigilaba una columna que siempre quedaba NULL, y las filas
 * huérfanas en user_id pasaban sin control.
 *
 * Antes de eliminar la columna se rellenan las user_id que hubieran quedado
 * vacías, y se borran las filas que no puedan repararse: crear la llave foránea
 * falla si queda alguna que la incumpla.
 */
export class CorregirLlavesForaneasUsuario1788285677836
  implements MigrationInterface
{
  name = 'CorregirLlavesForaneasUsuario1788285677836';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- refresh_tokens ---
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT IF EXISTS "FK_610102b60fea1455310ccd299de"`,
    );
    // Rescata lo rescatable: si user_id quedó nulo pero userId tenía valor.
    await queryRunner.query(
      `UPDATE "refresh_tokens" SET "user_id" = "userId"
       WHERE "user_id" IS NULL AND "userId" IS NOT NULL`,
    );
    await queryRunner.query(
      `DELETE FROM "refresh_tokens"
       WHERE "user_id" IS NULL
          OR "user_id" NOT IN (SELECT "id" FROM "users")`,
    );
    await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens"
       ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"
       FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // --- reputation_events ---
    await queryRunner.query(
      `ALTER TABLE "reputation_events" DROP CONSTRAINT IF EXISTS "FK_eb96cc20e794442da40911314f8"`,
    );
    await queryRunner.query(
      `UPDATE "reputation_events" SET "user_id" = "userId"
       WHERE "user_id" IS NULL AND "userId" IS NOT NULL`,
    );
    await queryRunner.query(
      `DELETE FROM "reputation_events"
       WHERE "user_id" IS NULL
          OR "user_id" NOT IN (SELECT "id" FROM "users")`,
    );
    await queryRunner.query(`ALTER TABLE "reputation_events" DROP COLUMN IF EXISTS "userId"`);
    await queryRunner.query(
      `ALTER TABLE "reputation_events"
       ADD CONSTRAINT "FK_293465173241c39135fe3d9f4b2"
       FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Vuelve al estado anterior: la llave foránea sobre la columna "userId".
    // No se restauran valores porque en el esquema previo esa columna nunca se
    // escribía; quedaba NULL en todas las filas.
    await queryRunner.query(
      `ALTER TABLE "reputation_events" DROP CONSTRAINT "FK_293465173241c39135fe3d9f4b2"`,
    );
    await queryRunner.query(`ALTER TABLE "reputation_events" ADD "userId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "reputation_events"
       ADD CONSTRAINT "FK_eb96cc20e794442da40911314f8"
       FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
    );
    await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD "userId" uuid`);
    await queryRunner.query(
      `ALTER TABLE "refresh_tokens"
       ADD CONSTRAINT "FK_610102b60fea1455310ccd299de"
       FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }
}
