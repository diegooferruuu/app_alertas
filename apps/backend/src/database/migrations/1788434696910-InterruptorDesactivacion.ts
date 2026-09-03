import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * El interruptor de desactivación (H4.3).
 *
 * Añade dos cosas que van juntas:
 *
 *  - `desactivaciones`, el registro de que alguien retiró una alerta que lo
 *    identificaba. Guarda hashes y no identidades: para detectar reincidencia
 *    basta comparar, y quién es cada quién solo se revela por la constancia.
 *    La llave foránea es NO ACTION —no CASCADE— porque borrar la denuncia no
 *    puede llevarse por delante la constancia de que se retiró.
 *
 *  - Una restricción sobre `users` que el código ya cumplía por convención:
 *    un documento registrado tiene siempre hash. De eso depende el interruptor
 *    entero, que reconoce a la persona reportada comparando `ci_hash`; una
 *    cuenta verificada sin hash podría denunciar sin quedar nunca identificada
 *    como denunciante, y no podría retirar una alerta sobre sí misma.
 */

export class InterruptorDesactivacion1788434696910 implements MigrationInterface {
    name = 'InterruptorDesactivacion1788434696910'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "desactivaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "ci_hash_denunciante" character varying(64) NOT NULL, "ci_hash_persona_buscada" character varying(64) NOT NULL, "desactivada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c53e57c86ebc1e4a7c207410bf8" UNIQUE ("denuncia_id"), CONSTRAINT "PK_d34c131d41490e9a107f41f7d89" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_desactivaciones_persona_buscada" ON "desactivaciones" ("ci_hash_persona_buscada") `);
        await queryRunner.query(`CREATE INDEX "idx_desactivaciones_denunciante" ON "desactivaciones" ("ci_hash_denunciante") `);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "chk_users_documento_con_hash" CHECK (((documento_registrado = false) OR (ci_hash IS NOT NULL)))`);
        await queryRunner.query(`ALTER TABLE "desactivaciones" ADD CONSTRAINT "FK_c53e57c86ebc1e4a7c207410bf8" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "desactivaciones" DROP CONSTRAINT "FK_c53e57c86ebc1e4a7c207410bf8"`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_documento_con_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_desactivaciones_denunciante"`);
        await queryRunner.query(`DROP INDEX "public"."idx_desactivaciones_persona_buscada"`);
        await queryRunner.query(`DROP TABLE "desactivaciones"`);
    }

}
