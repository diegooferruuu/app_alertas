import { MigrationInterface, QueryRunner } from "typeorm";

export class CorreoCanonico1789417601301 implements MigrationInterface {
    name = 'CorreoCanonico1789417601301'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Primero se normaliza lo que ya está. En esta base no había ningún
        // correo fuera de forma, pero la migración tiene que poder correr en
        // cualquier otra: añadir la restricción sobre datos sin normalizar
        // fallaría a mitad de despliegue.
        //
        // Si dos cuentas colapsaran en el mismo correo al pasarlo a minúsculas,
        // este UPDATE falla por la unicidad de `email`. Es lo correcto: fundir
        // dos identidades no es algo que una migración pueda decidir sola.
        await queryRunner.query(
            `UPDATE "users" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"))`,
        );
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "chk_users_correo_canonico" CHECK (((email)::text = lower(btrim((email)::text))))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_correo_canonico"`);
    }

}
