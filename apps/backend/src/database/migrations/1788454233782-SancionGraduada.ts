import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sanción graduada (H4.5, §5.4, invariante I9).
 *
 * El booleano `is_suspended` se queda corto: la sanción no es todo-o-nada. Pasa
 * a `estado_cuenta` de tres valores —ACTIVA, RESTRINGIDA, SUSPENDIDA— con
 * `restringida_hasta` para el plazo de la restricción. Se conserva el valor
 * anterior en la conversión, aunque hoy no haya ninguna cuenta suspendida: la
 * suspensión no existía como mecanismo antes de esta fase.
 *
 * Y una tabla nueva, `documentos_bloqueados`, con el `ci_hash` de las cuentas
 * suspendidas, para impedir que una suspensión se esquive registrando de nuevo
 * el mismo documento en otra cuenta.
 */
export class SancionGraduada1788454233782 implements MigrationInterface {
    name = 'SancionGraduada1788454233782'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "documentos_bloqueados" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ci_hash" character varying(64) NOT NULL, "usuario_id" uuid, "motivo" character varying(60) NOT NULL, "bloqueado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_d61a954b96c89c840a94f66386a" UNIQUE ("ci_hash"), CONSTRAINT "PK_4c7f8da06e5b427b02efd9eb6d5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "users" ADD "estado_cuenta" character varying(20) NOT NULL DEFAULT 'ACTIVA'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "restringida_hasta" TIMESTAMP WITH TIME ZONE`);
        // Conserva el estado anterior antes de descartar la columna vieja.
        await queryRunner.query(`UPDATE "users" SET "estado_cuenta" = CASE WHEN "is_suspended" THEN 'SUSPENDIDA' ELSE 'ACTIVA' END`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_suspended"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "suspended_at"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "suspension_reason"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "chk_users_estado_cuenta" CHECK (((estado_cuenta)::text = ANY ((ARRAY['ACTIVA'::character varying, 'RESTRINGIDA'::character varying, 'SUSPENDIDA'::character varying])::text[])))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_estado_cuenta"`);
        await queryRunner.query(`ALTER TABLE "users" ADD "suspension_reason" text`);
        await queryRunner.query(`ALTER TABLE "users" ADD "suspended_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "is_suspended" boolean NOT NULL DEFAULT false`);
        // Revierte el estado suspendido al booleano; RESTRINGIDA se pierde, no
        // tenía equivalente en el modelo anterior.
        await queryRunner.query(`UPDATE "users" SET "is_suspended" = ("estado_cuenta" = 'SUSPENDIDA')`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "restringida_hasta"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "estado_cuenta"`);
        await queryRunner.query(`DROP TABLE "documentos_bloqueados"`);
    }

}
