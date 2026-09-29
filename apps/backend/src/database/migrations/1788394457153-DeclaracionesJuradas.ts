import { MigrationInterface, QueryRunner } from "typeorm";

export class DeclaracionesJuradas1788394457153 implements MigrationInterface {
    name = 'DeclaracionesJuradas1788394457153'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "declaraciones_juradas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "ci_hash_declarante" character varying(64) NOT NULL, "vinculo_declarado" character varying(30) NOT NULL, "tipo" character varying(20) NOT NULL DEFAULT 'original', "version_texto_legal_id" uuid NOT NULL, "hash_texto_legal" character varying(64) NOT NULL, "texto_firmado" text NOT NULL, "hash_contenido_denuncia" character varying(64) NOT NULL, "device_id" character varying(120), "firma_criptografica" text, "clave_publica_id" uuid, "hash_anterior" character varying(64), "hash_registro" character varying(64) NOT NULL, "firmada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_fdcd93b7fb91de83ae9efdd8245" UNIQUE ("hash_registro"), CONSTRAINT "PK_293bc313047ae632f27e1d23b07" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_declaraciones_usuario" ON "declaraciones_juradas" ("usuario_id") `);
        await queryRunner.query(`CREATE INDEX "idx_declaraciones_denuncia" ON "declaraciones_juradas" ("denuncia_id") `);
        await queryRunner.query(`ALTER TABLE "declaraciones_juradas" ADD CONSTRAINT "FK_25ad79c2e467b2e0b335529ff13" FOREIGN KEY ("version_texto_legal_id") REFERENCES "versiones_texto_legal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "declaraciones_juradas" DROP CONSTRAINT "FK_25ad79c2e467b2e0b335529ff13"`);
        await queryRunner.query(`DROP INDEX "public"."idx_declaraciones_denuncia"`);
        await queryRunner.query(`DROP INDEX "public"."idx_declaraciones_usuario"`);
        await queryRunner.query(`DROP TABLE "declaraciones_juradas"`);
    }

}
