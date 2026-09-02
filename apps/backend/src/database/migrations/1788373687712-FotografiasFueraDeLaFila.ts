import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * §12.7 — La fotografía sale de la fila de la denuncia.
 *
 * `denuncias` es la tabla sobre la que corre la consulta de proximidad, es
 * decir el mecanismo central del sistema. Cada imagen en base64 pesa cientos de
 * kilobytes, así que engordaba exactamente las filas que Postgres debe recorrer
 * para decidir a quién alerta.
 *
 * Las imágenes existentes se trasladan antes de eliminar la columna: la
 * migración no pierde ninguna. Sigue sin haber dependencia de un servicio
 * externo — la imagen continúa en nuestra base, solo que en otra tabla.
 */
export class FotografiasFueraDeLaFila1788373687712 implements MigrationInterface {
  name = 'FotografiasFueraDeLaFila1788373687712';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "fotografias_denuncia" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "denuncia_id" uuid NOT NULL,
        "contenido" text NOT NULL,
        "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_fotografias_denuncia" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_fotografias_denuncia" ON "fotografias_denuncia" ("denuncia_id")`,
    );
    await queryRunner.query(`
      ALTER TABLE "fotografias_denuncia"
      ADD CONSTRAINT "FK_c53c2a1e60650b12c0216545623"
      FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id")
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    // Traslada lo que ya existía. Sin esto la migración perdería imágenes.
    await queryRunner.query(`
      INSERT INTO "fotografias_denuncia" ("denuncia_id", "contenido")
      SELECT "id", "photo_base64" FROM "denuncias" WHERE "photo_base64" IS NOT NULL
    `);

    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "photo_base64"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "denuncias" ADD "photo_base64" text`);

    // Devuelve una imagen por denuncia: la columna original solo admitía una.
    // Si alguna llegara a tener varias, se conserva la más antigua, que es la
    // que estaba ahí antes de esta migración.
    await queryRunner.query(`
      UPDATE "denuncias" d
      SET "photo_base64" = f."contenido"
      FROM (
        SELECT DISTINCT ON ("denuncia_id") "denuncia_id", "contenido"
        FROM "fotografias_denuncia"
        ORDER BY "denuncia_id", "creada_en" ASC
      ) f
      WHERE f."denuncia_id" = d."id"
    `);

    await queryRunner.query(`DROP TABLE "fotografias_denuncia"`);
  }
}
