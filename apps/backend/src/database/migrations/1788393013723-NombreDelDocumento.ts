import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Guarda el nombre asociado al documento registrado.
 *
 * Hasta ahora el nombre se comparaba contra el texto del carnet y se descartaba.
 * La declaración jurada de la fase 2 exige que la persona escriba su nombre
 * completo a mano, y sin este dato esa comprobación no tendría contra qué
 * contrastarse.
 *
 * Nullable porque las cuentas que ya registraron su documento no lo tienen: se
 * completará la próxima vez que registren, y hasta entonces no podrán firmar.
 */

export class NombreDelDocumento1788393013723 implements MigrationInterface {
    name = 'NombreDelDocumento1788393013723'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "nombre_documento" character varying(120)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "nombre_documento"`);
    }

}
