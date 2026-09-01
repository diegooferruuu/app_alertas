import { MigrationInterface, QueryRunner } from "typeorm";

export class EsquemaInicial1788234098935 implements MigrationInterface {
    name = 'EsquemaInicial1788234098935'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Extensiones requeridas por el esquema: uuid_generate_v4() para las
        // claves primarias y PostGIS para las columnas geográficas. TypeORM no
        // las genera, así que van explícitas para que una base limpia funcione.
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" ("user_id") `);
        await queryRunner.query(`CREATE TABLE "reputation_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "delta" integer NOT NULL, "reason" character varying(100) NOT NULL, "reference_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "userId" uuid, CONSTRAINT "PK_27bf0668993ad863b678979548a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "full_name" character varying(120) NOT NULL, "email" character varying(255) NOT NULL, "phone" character varying(20), "password_hash" character varying(255) NOT NULL, "identity_verified" boolean NOT NULL DEFAULT false, "ci_hash" character varying(64), "identity_verified_at" TIMESTAMP WITH TIME ZONE, "reputation_score" integer NOT NULL DEFAULT '100', "is_suspended" boolean NOT NULL DEFAULT false, "suspended_at" TIMESTAMP WITH TIME ZONE, "suspension_reason" text, "push_token" character varying(255), "push_token_updated_at" TIMESTAMP WITH TIME ZONE, "last_location" geography(Point,4326), "last_location_at" TIMESTAMP WITH TIME ZONE, "role" character varying(20) NOT NULL DEFAULT 'citizen', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_7d7c176036b81c303553d91b2d2" UNIQUE ("ci_hash"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_users_push_token" ON "users" ("push_token") WHERE "push_token" IS NOT NULL`);
        await queryRunner.query(`CREATE INDEX "idx_users_ci_hash" ON "users" ("ci_hash") `);
        await queryRunner.query(`CREATE INDEX "idx_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE TABLE "incidents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "reporter_id" uuid NOT NULL, "category" character varying(40) NOT NULL, "victim_name" character varying(120), "description" text NOT NULL, "latitude" double precision NOT NULL, "longitude" double precision NOT NULL, "photo_base64" text, "status" character varying(20) NOT NULL DEFAULT 'activo', "confirmations_count" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_ccb34c01719889017e2246469f9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_incidents_created_at" ON "incidents" ("created_at") `);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reputation_events" ADD CONSTRAINT "FK_eb96cc20e794442da40911314f8" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "incidents" ADD CONSTRAINT "FK_997933e2e9897cd680e453805ca" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "incidents" DROP CONSTRAINT "FK_997933e2e9897cd680e453805ca"`);
        await queryRunner.query(`ALTER TABLE "reputation_events" DROP CONSTRAINT "FK_eb96cc20e794442da40911314f8"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`DROP INDEX "public"."idx_incidents_created_at"`);
        await queryRunner.query(`DROP TABLE "incidents"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_email"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_ci_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_users_push_token"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "reputation_events"`);
        await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_user"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    }

}
