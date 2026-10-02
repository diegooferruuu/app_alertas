import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * «La encontramos»: la fecha en que quien denunció dio el caso por terminado.
 *
 * El estado CERRADA existía pero ninguna ruta llegaba a él. Ahora lo pone el
 * autor, y la restricción ata la fecha al estado en los dos sentidos.
 */
export class FechaDeCierreDelCaso1790897202835 implements MigrationInterface {
    name = 'FechaDeCierreDelCaso1790897202835'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "cerrada_en" TIMESTAMP WITH TIME ZONE`);
        // Una CERRADA anterior a esta migración no tiene fecha, y sin ella la
        // restricción no se podría crear. La mejor aproximación disponible es la
        // última vez que se tocó la fila.
        await queryRunner.query(`UPDATE "denuncias" SET "cerrada_en" = "updated_at" WHERE "estado" = 'CERRADA'`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_cerrada_con_fecha" CHECK ((((((estado)::text = 'CERRADA'::text) AND (cerrada_en IS NOT NULL)) OR (((estado)::text <> 'CERRADA'::text) AND (cerrada_en IS NULL)))))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_cerrada_con_fecha"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "cerrada_en"`);
    }

}
