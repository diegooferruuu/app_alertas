import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * El único rastro de un avistamiento en el servidor: que se tocó un canal.
 *
 * Sin usuario, sin lugar y con la hora truncada al minuto (I2). El reporte en
 * sí viaja del teléfono a la autoridad y no pasa por aquí.
 */
export class UsosCanalAvistamiento1790895501932 implements MigrationInterface {
    name = 'UsosCanalAvistamiento1790895501932'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "usos_canal_avistamiento" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "canal" character varying(10) NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('minute', now()), CONSTRAINT "chk_usos_canal_al_minuto" CHECK ((creado_en = date_trunc('minute'::text, creado_en))), CONSTRAINT "chk_usos_canal_canal" CHECK (((canal)::text = ANY ((ARRAY['LLAMADA'::character varying, 'MENSAJE'::character varying])::text[]))), CONSTRAINT "PK_93e8748b0b5d3b3f3f3cbfb2435" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_usos_canal_denuncia" ON "usos_canal_avistamiento" ("denuncia_id") `);
        await queryRunner.query(`ALTER TABLE "usos_canal_avistamiento" ADD CONSTRAINT "FK_40dbc895cc2ca51ada6ff133922" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "usos_canal_avistamiento" DROP CONSTRAINT "FK_40dbc895cc2ca51ada6ff133922"`);
        await queryRunner.query(`DROP INDEX "public"."idx_usos_canal_denuncia"`);
        await queryRunner.query(`DROP TABLE "usos_canal_avistamiento"`);
    }

}
