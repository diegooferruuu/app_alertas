import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Desglosa el nombre de la cuenta en sus cuatro partes.
 *
 * Las columnas son nulas a propósito y las filas existentes **no se tocan**.
 * Rellenarlas exigiría partir `full_name` por espacios y adivinar qué palabra es
 * nombre y cuál apellido; cuando la suposición fallara, el nombre compuesto
 * dejaría de coincidir con `nombre_documento`, y con él se caerían la
 * comprobación de la firma escrita a mano y la correspondencia con las
 * constancias ya selladas en la cadena de hashes. Una cuenta anterior conserva
 * su `full_name` y sus partes en nulo; la restricción admite ese caso de forma
 * explícita.
 */
export class NombreDesglosado1789157066439 implements MigrationInterface {
    name = 'NombreDesglosado1789157066439'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "primer_nombre" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "segundo_nombre" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "primer_apellido" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD "segundo_apellido" character varying(30)`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "chk_users_nombre_completo_o_ausente" CHECK ((((primer_nombre IS NULL) AND (primer_apellido IS NULL) AND (segundo_apellido IS NULL)) OR ((primer_nombre IS NOT NULL) AND (primer_apellido IS NOT NULL) AND (segundo_apellido IS NOT NULL))))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_nombre_completo_o_ausente"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "segundo_apellido"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "primer_apellido"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "segundo_nombre"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "primer_nombre"`);
    }

}
