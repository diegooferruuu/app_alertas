import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Emisión de alertas: dispositivos, cola y registro de entregas.
 *
 * `emisiones_alerta` hace dos papeles a la vez. Es la **cola**: la fila se crea
 * en la misma transacción que la firma, de modo que no puede existir una
 * denuncia firmada cuya alerta nunca se encoló. Y es el **registro** de lo
 * ocurrido: guarda el radio vigente al emitir y a cuánta gente alcanzó.
 *
 * `entregas_alerta` es lo que da las métricas de validación del sistema:
 * latencia entre firmar y alertar, precisión de la segmentación —gracias a
 * `distancia_m`, que se guarda al emitir porque recalcularla después daría otro
 * número, la gente se mueve— y tasa de entrega por plataforma.
 *
 * `dispositivos` sustituye a `users.push_token`, que al ser una sola columna
 * dejaba sin avisar a quien usa dos teléfonos.
 */

export class EmisionDeAlertas1788410781464 implements MigrationInterface {
    name = 'EmisionDeAlertas1788410781464'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "emisiones_alerta" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "radio_m" integer NOT NULL, "motivo" character varying(20) NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'pendiente', "destinatarios" integer, "intentos" integer NOT NULL DEFAULT '0', "ultimo_error" text, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "emitida_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e52f5b409f033ece24c150eb878" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_emisiones_pendientes" ON "emisiones_alerta" ("estado") WHERE "estado" IN ('pendiente', 'procesando')`);
        await queryRunner.query(`CREATE INDEX "idx_emisiones_denuncia" ON "emisiones_alerta" ("denuncia_id") `);
        await queryRunner.query(`CREATE TABLE "entregas_alerta" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "emision_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "dispositivo_id" uuid NOT NULL, "distancia_m" integer NOT NULL, "estado" character varying(20) NOT NULL DEFAULT 'encolada', "resultado_pasarela" text, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actualizada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_f3f65beecbc2d865f81adf74f10" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_entregas_usuario" ON "entregas_alerta" ("usuario_id") `);
        await queryRunner.query(`CREATE INDEX "idx_entregas_emision" ON "entregas_alerta" ("emision_id") `);
        await queryRunner.query(`CREATE TABLE "dispositivos" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "push_token" character varying(255) NOT NULL, "plataforma" character varying(20) NOT NULL, "ultima_actividad" TIMESTAMP WITH TIME ZONE NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_cdcd4f3980e28801bd0af96a41b" UNIQUE ("push_token"), CONSTRAINT "PK_e9595bb1be0bf2b2e376b904434" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_dispositivos_usuario" ON "dispositivos" ("usuario_id") `);
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" ADD CONSTRAINT "FK_996982ebd1be7b55177e049e004" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "entregas_alerta" ADD CONSTRAINT "FK_895d6e6d9b6a10c7a3cf4dd705d" FOREIGN KEY ("emision_id") REFERENCES "emisiones_alerta"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "dispositivos" ADD CONSTRAINT "FK_8e1ab92ee60373dfa266103c9b3" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "dispositivos" DROP CONSTRAINT "FK_8e1ab92ee60373dfa266103c9b3"`);
        await queryRunner.query(`ALTER TABLE "entregas_alerta" DROP CONSTRAINT "FK_895d6e6d9b6a10c7a3cf4dd705d"`);
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" DROP CONSTRAINT "FK_996982ebd1be7b55177e049e004"`);
        await queryRunner.query(`DROP INDEX "public"."idx_dispositivos_usuario"`);
        await queryRunner.query(`DROP TABLE "dispositivos"`);
        await queryRunner.query(`DROP INDEX "public"."idx_entregas_emision"`);
        await queryRunner.query(`DROP INDEX "public"."idx_entregas_usuario"`);
        await queryRunner.query(`DROP TABLE "entregas_alerta"`);
        await queryRunner.query(`DROP INDEX "public"."idx_emisiones_denuncia"`);
        await queryRunner.query(`DROP INDEX "public"."idx_emisiones_pendientes"`);
        await queryRunner.query(`DROP TABLE "emisiones_alerta"`);
    }

}
