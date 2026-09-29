import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Recibos de entrega: saber si Apple o Google recibieron cada notificación.
 *
 * Hasta aquí, `aceptada` era el último estado de una entrega y solo decía que
 * Expo había tomado el mensaje. Una tasa de entrega medida con esa columna era
 * un techo, no la tasa real. El recibo que Expo da por cada ticket, unos minutos
 * después, dice qué pasó: `despachada`, `no_despachada` o, si no se consiguió a
 * tiempo, `sin_recibo`.
 */
export class RecibosDeEntrega1790717502917 implements MigrationInterface {
    name = 'RecibosDeEntrega1790717502917'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "entregas_alerta" ADD "ticket_id" character varying(64)`);
        await queryRunner.query(`ALTER TABLE "entregas_alerta" ADD "resultado_recibo" text`);
        await queryRunner.query(`ALTER TABLE "entregas_alerta" ADD "recibo_en" TIMESTAMP WITH TIME ZONE`);

        // El ticket de las entregas ya aceptadas estaba escrito dentro del texto
        // de `resultado_pasarela` («ticket <id>»). Se rescata a su columna. Son
        // de hace días y Expo ya borró sus recibos, así que el worker las dejará
        // `sin_recibo`, pero el dato no se pierde.
        await queryRunner.query(`
            UPDATE "entregas_alerta"
               SET "ticket_id" = substring("resultado_pasarela" from '^ticket ([0-9A-Za-z-]+)$')
             WHERE "estado" = 'aceptada'
               AND "resultado_pasarela" ~ '^ticket [0-9A-Za-z-]+$'
        `);

        await queryRunner.query(`ALTER TABLE "entregas_alerta" ADD CONSTRAINT "chk_entregas_estado" CHECK (((estado)::text = ANY ((ARRAY['encolada'::character varying, 'aceptada'::character varying, 'fallida'::character varying, 'despachada'::character varying, 'no_despachada'::character varying, 'sin_recibo'::character varying])::text[])))`);
        await queryRunner.query(`CREATE INDEX "idx_entregas_esperando_recibo" ON "entregas_alerta" ("id") WHERE "estado" = 'aceptada'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_entregas_esperando_recibo"`);
        await queryRunner.query(`ALTER TABLE "entregas_alerta" DROP CONSTRAINT "chk_entregas_estado"`);

        // Antes de esta migración, lo que Expo aceptó terminaba en `aceptada`: es
        // lo único que el esquema anterior sabe decir de esas entregas.
        await queryRunner.query(`
            UPDATE "entregas_alerta" SET "estado" = 'aceptada'
             WHERE "estado" IN ('despachada', 'no_despachada', 'sin_recibo')
        `);

        await queryRunner.query(`ALTER TABLE "entregas_alerta" DROP COLUMN "recibo_en"`);
        await queryRunner.query(`ALTER TABLE "entregas_alerta" DROP COLUMN "resultado_recibo"`);
        await queryRunner.query(`ALTER TABLE "entregas_alerta" DROP COLUMN "ticket_id"`);
    }
}
