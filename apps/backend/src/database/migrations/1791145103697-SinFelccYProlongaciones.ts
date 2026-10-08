import { MigrationInterface, QueryRunner } from "typeorm";
import { createHash } from "crypto";
import { TEXTO_LEGAL_V3, VERSION_SIN_FELCC } from "../../declaraciones/texto-legal";

/**
 * Sin la FELCC, y alertas que se prolongan (2026-10-04).
 *
 *  - El número de caso de la FELCC no es público, así que el sistema no podía
 *    comprobarlo, y daba privilegios: más alcance, saltarse el límite de
 *    alertas y el efecto de una falta. Se quitan la columna y el nivel
 *    CORROBORADA. Las denuncias corroboradas pasan a PROVISIONAL; su radio no
 *    se toca, porque describe lo que efectivamente se emitió.
 *  - `prolongaciones`: cada prolongación de una alerta, firmada con el teléfono.
 *    Es de solo inserción, como las declaraciones. `denuncias.prolongaciones`
 *    es su contador.
 *  - Se publica el texto legal v3, que describe las dos cosas y la suspensión
 *    de siete días que deja cada falta.
 *
 * Lo que está en tablas de solo inserción no se toca: las declaraciones de tipo
 * `corroboracion` y las emisiones con ese motivo quedan como historia. Cambiarlas
 * rompería la cadena de hashes, que es lo que prueba que nadie las alteró.
 */
export class SinFelccYProlongaciones1791145103697 implements MigrationInterface {
    name = 'SinFelccYProlongaciones1791145103697'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // --- sin la FELCC --------------------------------------------------
        await queryRunner.query(`UPDATE "denuncias" SET "nivel_confianza" = 'PROVISIONAL' WHERE "nivel_confianza" = 'CORROBORADA'`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_nivel_confianza"`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_nivel_confianza" CHECK (((nivel_confianza)::text = ANY ((ARRAY['REGISTRADA'::character varying, 'PROVISIONAL'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "numero_caso_felcc"`);

        // --- prolongaciones ------------------------------------------------
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "prolongaciones" smallint NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_prolongaciones" CHECK (((prolongaciones >= 0) AND (((nivel_confianza)::text <> 'REGISTRADA'::text) OR (prolongaciones = 0))))`);

        await queryRunner.query(`CREATE TABLE "prolongaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "usuario_id" uuid NOT NULL, "numero" smallint NOT NULL, "version_texto_legal_id" uuid NOT NULL, "hash_texto_legal" character varying(64) NOT NULL, "clave_dispositivo_id" uuid NOT NULL, "firma_dispositivo" character varying(128) NOT NULL, "expira_en" TIMESTAMP WITH TIME ZONE NOT NULL, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_prolongaciones_firma" CHECK (((firma_dispositivo)::text ~ '^[0-9a-f]{128}$'::text)), CONSTRAINT "chk_prolongaciones_numero" CHECK ((numero >= 1)), CONSTRAINT "PK_f93458504304267e954ad118764" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_prolongaciones_denuncia_numero" ON "prolongaciones" ("denuncia_id", "numero") `);
        await queryRunner.query(`ALTER TABLE "prolongaciones" ADD CONSTRAINT "FK_cc2874e1672389c7adbd885464b" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prolongaciones" ADD CONSTRAINT "FK_2ecbf168acb84021c1ea98a69a2" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prolongaciones" ADD CONSTRAINT "FK_45ec23ea711dadd2bc260e3275a" FOREIGN KEY ("clave_dispositivo_id") REFERENCES "claves_dispositivo"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "prolongaciones" ADD CONSTRAINT "FK_4b0966ce5ac4b29c537943a7c58" FOREIGN KEY ("version_texto_legal_id") REFERENCES "versiones_texto_legal"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION impedir_modificar_prolongaciones()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION
                    'Las prolongaciones son de solo inserción: cada una es una firma, y una firma que se pudiera cambiar o borrar no atribuiría nada.'
                    USING ERRCODE = 'restrict_violation';
            END;
            $$ LANGUAGE plpgsql;
        `);
        await queryRunner.query(`
            CREATE TRIGGER trg_prolongaciones_solo_insercion
            BEFORE UPDATE OR DELETE ON "prolongaciones"
            FOR EACH ROW EXECUTE FUNCTION impedir_modificar_prolongaciones();
        `);

        // --- texto legal v3 ------------------------------------------------
        // Primero se retira la vigente, porque el índice permite solo una.
        const hash = createHash('sha256').update(TEXTO_LEGAL_V3, 'utf8').digest('hex');
        await queryRunner.query(`UPDATE "versiones_texto_legal" SET "vigente" = false WHERE "vigente" = true`);
        await queryRunner.query(
            `INSERT INTO "versiones_texto_legal" ("version", "texto", "hash_texto", "vigente")
             VALUES ($1, $2, $3, true)
             ON CONFLICT ("version") DO UPDATE SET "vigente" = true`,
            [VERSION_SIN_FELCC, TEXTO_LEGAL_V3, hash],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Texto legal: vuelve a regir la v2. La v3 se borra solo si nadie firmó
        // con ella; si alguien lo hizo, queda —no vigente— porque su declaración
        // la referencia.
        await queryRunner.query(`UPDATE "versiones_texto_legal" SET "vigente" = false WHERE "version" = $1`, [VERSION_SIN_FELCC]);
        await queryRunner.query(`UPDATE "versiones_texto_legal" SET "vigente" = true WHERE "version" = 'v2'`);

        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_prolongaciones_solo_insercion ON "prolongaciones"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS impedir_modificar_prolongaciones()`);
        await queryRunner.query(`ALTER TABLE "prolongaciones" DROP CONSTRAINT "FK_4b0966ce5ac4b29c537943a7c58"`);
        await queryRunner.query(`ALTER TABLE "prolongaciones" DROP CONSTRAINT "FK_45ec23ea711dadd2bc260e3275a"`);
        await queryRunner.query(`ALTER TABLE "prolongaciones" DROP CONSTRAINT "FK_2ecbf168acb84021c1ea98a69a2"`);
        await queryRunner.query(`ALTER TABLE "prolongaciones" DROP CONSTRAINT "FK_cc2874e1672389c7adbd885464b"`);
        await queryRunner.query(`DROP INDEX "public"."uq_prolongaciones_denuncia_numero"`);
        await queryRunner.query(`DROP TABLE "prolongaciones"`);

        await queryRunner.query(
            `DELETE FROM "versiones_texto_legal" v
              WHERE v."version" = $1
                AND NOT EXISTS (SELECT 1 FROM "declaraciones_juradas" d WHERE d."version_texto_legal_id" = v."id")`,
            [VERSION_SIN_FELCC],
        );

        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_prolongaciones"`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "prolongaciones"`);

        // Los números de caso que hubo no vuelven, y las denuncias que estaban
        // corroboradas siguen PROVISIONAL: no hay de dónde recuperar ninguna de
        // las dos cosas.
        await queryRunner.query(`ALTER TABLE "denuncias" ADD "numero_caso_felcc" character varying(60)`);
        await queryRunner.query(`ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_nivel_confianza"`);
        await queryRunner.query(`ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_nivel_confianza" CHECK (((nivel_confianza)::text = ANY ((ARRAY['REGISTRADA'::character varying, 'PROVISIONAL'::character varying, 'CORROBORADA'::character varying])::text[])))`);
    }

}
