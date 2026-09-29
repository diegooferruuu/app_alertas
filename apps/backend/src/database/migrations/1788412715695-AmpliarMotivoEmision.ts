import { MigrationInterface, QueryRunner } from "typeorm";

export class AmpliarMotivoEmision1788412715695 implements MigrationInterface {
    name = 'AmpliarMotivoEmision1788412715695'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" DROP COLUMN "motivo"`);
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" ADD "motivo" character varying(40) NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" DROP COLUMN "motivo"`);
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" ADD "motivo" character varying(20) NOT NULL`);
    }

}
