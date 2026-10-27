import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Reportes del contenido de una alerta y ocultamiento de su foto (política de
 * contenido generado por usuarios de Google Play).
 *
 * Las dos tablas son de solo inserción, como el resto de lo que deja rastro:
 * un reporte o un ocultamiento que se pudiera reescribir no probaría cuándo ni
 * por qué se pidió o se hizo.
 *
 * Eliminar una cuenta no necesita cambios de esquema: usa `users.deleted_at`,
 * que existía desde el esquema inicial.
 */
export class ReportesDeContenido1793143800497 implements MigrationInterface {
    name = 'ReportesDeContenido1793143800497'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "reportes_contenido" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "motivo" character varying(30) NOT NULL, "detalle" character varying(500), "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_reportes_contenido_denuncia_usuario" UNIQUE ("denuncia_id", "usuario_id"), CONSTRAINT "chk_reportes_contenido_motivo" CHECK (((motivo)::text = ANY ((ARRAY['imagen_inapropiada'::character varying, 'contenido_ofensivo'::character varying, 'no_es_una_desaparicion'::character varying, 'otro'::character varying])::text[]))), CONSTRAINT "PK_24a4aace0021354ea3d6ab36038" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "ocultamientos_contenido" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "motivo" text NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_139704a322272660d29b8d8eae6" UNIQUE ("denuncia_id"), CONSTRAINT "PK_4e64e265e77d3b63bded0ae74ca" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reportes_contenido" ADD CONSTRAINT "FK_4dec5324ff9f63bc08f89876ee9" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "reportes_contenido" ADD CONSTRAINT "FK_4795e27c200fe36c8d0cedd0624" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ocultamientos_contenido" ADD CONSTRAINT "FK_139704a322272660d29b8d8eae6" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        for (const [tabla, que] of [
            ['reportes_contenido', 'Los reportes de contenido son de solo inserción: son el rastro de lo que se pidió y cuándo.'],
            ['ocultamientos_contenido', 'Los ocultamientos de contenido son de solo inserción: dejan constancia de cuándo y por qué se ocultó.'],
        ]) {
            await queryRunner.query(`
                CREATE OR REPLACE FUNCTION impedir_modificar_${tabla}()
                RETURNS TRIGGER AS $$
                BEGIN
                    RAISE EXCEPTION '${que}' USING ERRCODE = 'restrict_violation';
                END;
                $$ LANGUAGE plpgsql;
            `);
            await queryRunner.query(`
                CREATE TRIGGER trg_${tabla}_solo_insercion
                BEFORE UPDATE OR DELETE ON "${tabla}"
                FOR EACH ROW EXECUTE FUNCTION impedir_modificar_${tabla}();
            `);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const tabla of ['ocultamientos_contenido', 'reportes_contenido']) {
            await queryRunner.query(`DROP TRIGGER IF EXISTS trg_${tabla}_solo_insercion ON "${tabla}"`);
            await queryRunner.query(`DROP FUNCTION IF EXISTS impedir_modificar_${tabla}()`);
        }
        await queryRunner.query(`ALTER TABLE "ocultamientos_contenido" DROP CONSTRAINT "FK_139704a322272660d29b8d8eae6"`);
        await queryRunner.query(`ALTER TABLE "reportes_contenido" DROP CONSTRAINT "FK_4795e27c200fe36c8d0cedd0624"`);
        await queryRunner.query(`ALTER TABLE "reportes_contenido" DROP CONSTRAINT "FK_4dec5324ff9f63bc08f89876ee9"`);
        await queryRunner.query(`DROP TABLE "ocultamientos_contenido"`);
        await queryRunner.query(`DROP TABLE "reportes_contenido"`);
    }

}
