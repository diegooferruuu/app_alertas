import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * H6.3: las claves públicas de los teléfonos que firman declaraciones.
 *
 * Es de solo inserción, como las declaraciones que apuntan a ella: si una clave
 * se pudiera cambiar o borrar, las firmas hechas con ella dejarían de poder
 * verificarse.
 */
export class ClavesDeDispositivo1790906860841 implements MigrationInterface {
    name = 'ClavesDeDispositivo1790906860841'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "claves_dispositivo" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "clave_publica" character varying(64) NOT NULL, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_6d3f0824d31e89bdf4d7d21d39f" UNIQUE ("clave_publica"), CONSTRAINT "chk_claves_dispositivo_formato" CHECK (((clave_publica)::text ~ '^[0-9a-f]{64}$'::text)), CONSTRAINT "PK_35fbe32436d0d698cd20e60b5ec" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_claves_dispositivo_usuario" ON "claves_dispositivo" ("usuario_id") `);
        await queryRunner.query(`ALTER TABLE "claves_dispositivo" ADD CONSTRAINT "FK_b596a0597a9d30cbcd553e1ae5b" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "declaraciones_juradas" ADD CONSTRAINT "FK_3872082c2833aa77f43bd7c57ae" FOREIGN KEY ("clave_publica_id") REFERENCES "claves_dispositivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION impedir_modificar_claves_dispositivo()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION
                    'Las claves de dispositivo son de solo inserción: las firmas hechas con ellas tienen que seguir pudiendo verificarse. Un teléfono nuevo registra una clave nueva.'
                    USING ERRCODE = 'restrict_violation';
            END;
            $$ LANGUAGE plpgsql;
        `);
        await queryRunner.query(`
            CREATE TRIGGER trg_claves_dispositivo_solo_insercion
            BEFORE UPDATE OR DELETE ON "claves_dispositivo"
            FOR EACH ROW EXECUTE FUNCTION impedir_modificar_claves_dispositivo();
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_claves_dispositivo_solo_insercion ON "claves_dispositivo"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS impedir_modificar_claves_dispositivo()`);
        await queryRunner.query(`ALTER TABLE "declaraciones_juradas" DROP CONSTRAINT "FK_3872082c2833aa77f43bd7c57ae"`);
        await queryRunner.query(`ALTER TABLE "claves_dispositivo" DROP CONSTRAINT "FK_b596a0597a9d30cbcd553e1ae5b"`);
        await queryRunner.query(`DROP INDEX "public"."idx_claves_dispositivo_usuario"`);
        await queryRunner.query(`DROP TABLE "claves_dispositivo"`);
    }

}
