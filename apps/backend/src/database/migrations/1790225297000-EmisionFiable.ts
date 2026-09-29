import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Entrega fiable de alertas: una entrega por dispositivo y emisión, y
 * emisiones que no se quedan atascadas.
 *
 * Dos defectos que solo se notan cuando algo falla a mitad de una emisión:
 *
 *  - Un reintento volvía a insertar las entregas y a notificar a todos. Nada
 *    impedía dos filas para el mismo teléfono en la misma emisión.
 *  - Una emisión marcada «procesando» cuyo proceso moría antes de terminar no
 *    se volvía a tomar nunca: la alerta no salía y nadie se enteraba.
 */
export class EmisionFiable1790225297000 implements MigrationInterface {
    name = 'EmisionFiable1790225297000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Primero se deja una sola fila por teléfono y emisión, para que el
        // índice único pueda crearse. En la base de desarrollo no había
        // duplicados, pero la migración tiene que poder correr en cualquier
        // otra: el defecto que corrige es justamente el que los producía.
        //
        // Se conserva la fila con resultado antes que una «encolada», y entre
        // iguales la más antigua. Lo que se borra son copias del mismo intento
        // de entrega, no entregas distintas. No se puede deshacer en `down`.
        await queryRunner.query(`
            DELETE FROM "entregas_alerta" e
             USING (
                SELECT id, row_number() OVER (
                         PARTITION BY emision_id, dispositivo_id
                         ORDER BY (estado = 'encolada'), creada_en, id
                       ) AS orden
                  FROM "entregas_alerta"
             ) d
             WHERE e.id = d.id AND d.orden > 1
        `);

        // El índice único reemplaza al que había solo sobre `emision_id`: como
        // empieza por esa columna, sirve igual para buscar las entregas de una
        // emisión, y mantener los dos solo encarecía cada inserción.
        await queryRunner.query(`DROP INDEX "public"."idx_entregas_emision"`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_entregas_emision_dispositivo" ON "entregas_alerta" ("emision_id", "dispositivo_id") `);

        // Cuándo tomó la emisión el trabajador que la está procesando. Si deja
        // de renovarse, el trabajador murió y otro puede retomarla.
        //
        // Nulo en las filas existentes. Una emisión «procesando» sin marca solo
        // puede ser una atascada por el código anterior, y se trata como vencida.
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" ADD "tomada_en" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" DROP COLUMN "tomada_en"`);
        await queryRunner.query(`DROP INDEX "public"."uq_entregas_emision_dispositivo"`);
        await queryRunner.query(`CREATE INDEX "idx_entregas_emision" ON "entregas_alerta" ("emision_id") `);
    }

}
