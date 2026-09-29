import { MigrationInterface, QueryRunner } from "typeorm";

export class IndiceGeograficoUsuarios1788298780452 implements MigrationInterface {
    name = 'IndiceGeograficoUsuarios1788298780452'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "idx_users_last_location" ON "users" USING GiST ("last_location") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_users_last_location"`);
    }

}
