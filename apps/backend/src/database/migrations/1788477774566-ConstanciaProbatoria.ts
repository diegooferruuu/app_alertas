import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Constancia probatoria: rastro de las solicitudes (H6.1, §6.1).
 *
 * Entregar la identidad de quien denunció es un acto deliberado, así que queda
 * auditado: quién pidió qué constancia y cuándo. Sin unicidad a propósito — la
 * constancia está disponible de forma indefinida y cada entrega se registra por
 * separado, porque lo que interesa auditar es cada una, no que exista alguna.
 */
export class ConstanciaProbatoria1788477774566 implements MigrationInterface {
    name = 'ConstanciaProbatoria1788477774566'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "solicitudes_constancia" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "solicitante_id" uuid NOT NULL, "ci_hash_solicitante" character varying(64) NOT NULL, "alcance" character varying(30) NOT NULL, "solicitada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_772b36e88001235f7acc7d615ee" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_solicitudes_constancia_solicitante" ON "solicitudes_constancia" ("solicitante_id") `);
        await queryRunner.query(`CREATE INDEX "idx_solicitudes_constancia_denuncia" ON "solicitudes_constancia" ("denuncia_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_solicitudes_constancia_denuncia"`);
        await queryRunner.query(`DROP INDEX "public"."idx_solicitudes_constancia_solicitante"`);
        await queryRunner.query(`DROP TABLE "solicitudes_constancia"`);
    }

}
