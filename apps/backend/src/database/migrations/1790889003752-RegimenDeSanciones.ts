import { MigrationInterface, QueryRunner } from "typeorm";
import { createHash } from "crypto";
import { TEXTO_LEGAL_V2, VERSION_REGIMEN_FALTAS } from "../../declaraciones/texto-legal";

/**
 * Régimen de sanciones por faltas, en lugar de reputación y restricción temporal.
 *
 * Lo que cambia:
 *  - `desactivaciones` se reemplaza por `cierres`, con dos tipos: «Estoy bien»
 *    (sin sanción) y «Esta denuncia es falsa» (con sanción).
 *  - Nace `faltas`, el historial de sanciones de cada cuenta.
 *  - Las dos son de solo inserción (I11), con disparador.
 *  - Desaparecen el puntaje de reputación, el rol y la restricción temporal.
 *  - Una sola denuncia abierta por denunciante y persona, garantizado por índice.
 *  - Se publica la versión 2 del texto legal, que describe este régimen. Lo que
 *    se jura tiene que coincidir con lo que el sistema hace.
 *
 * Datos existentes: cada desactivación pasa a ser un cierre CON_SANCION —era su
 * efecto— con su falta y su fecha original; las cuentas RESTRINGIDAS vuelven a
 * ACTIVA, porque su restricción pasa a expresarse como falta; las SUSPENDIDAS
 * siguen suspendidas.
 */
export class RegimenDeSanciones1790889003752 implements MigrationInterface {
    name = 'RegimenDeSanciones1790889003752'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // El índice único de denuncias abiertas no se puede crear si ya hay
        // duplicados. Se avisa con qué hacer en vez de fallar con un error
        // críptico de la base a mitad de la migración.
        const [{ duplicados }] = await queryRunner.query(`
            SELECT count(*)::int AS duplicados FROM (
                SELECT 1 FROM "denuncias" WHERE "estado" IN ('ACTIVA', 'CADUCADA')
                 GROUP BY "denunciante_id", "ci_hash_persona_buscada" HAVING count(*) > 1
            ) d
        `);
        if (duplicados > 0) {
            throw new Error(
                `Hay ${duplicados} denunciantes con más de una denuncia abierta sobre la misma persona. ` +
                `Antes de migrar, deja una sola abierta por persona.`,
            );
        }

        // --- tablas nuevas -------------------------------------------------
        await queryRunner.query(`CREATE TABLE "faltas" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "usuario_id" uuid NOT NULL, "tipo" character varying(40) NOT NULL, "denuncia_id" uuid NOT NULL, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "uq_faltas_usuario_tipo_denuncia" UNIQUE ("usuario_id", "tipo", "denuncia_id"), CONSTRAINT "chk_faltas_tipo" CHECK (((tipo)::text = 'CIERRE_CON_SANCION'::text)), CONSTRAINT "PK_f5990e028829287d55315bd6ed2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "cierres" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "ci_hash_denunciante" character varying(64) NOT NULL, "ci_hash_persona_buscada" character varying(64) NOT NULL, "tipo_cierre" character varying(20) NOT NULL, "bloquea_nueva_denuncia" boolean NOT NULL, "creado_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_f09952be05884d2f17fb7f219d6" UNIQUE ("denuncia_id"), CONSTRAINT "chk_cierres_falsa_bloquea" CHECK ((((tipo_cierre)::text <> 'CON_SANCION'::text) OR bloquea_nueva_denuncia)), CONSTRAINT "chk_cierres_tipo" CHECK (((tipo_cierre)::text = ANY ((ARRAY['SIN_SANCION'::character varying, 'CON_SANCION'::character varying])::text[]))), CONSTRAINT "PK_d581713e75def51ce8cbfd9b57d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_cierres_denunciante_persona" ON "cierres" ("ci_hash_denunciante", "ci_hash_persona_buscada") `);
        await queryRunner.query(`ALTER TABLE "faltas" ADD CONSTRAINT "FK_9b6d0745cf62c168674798bf726" FOREIGN KEY ("usuario_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "faltas" ADD CONSTRAINT "FK_353453e753073b02b28b4f19459" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "cierres" ADD CONSTRAINT "FK_f09952be05884d2f17fb7f219d6" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // --- datos existentes ----------------------------------------------
        // Antes de los disparadores: son inserciones, pero conviene que la carga
        // ocurra sobre tablas todavía sin reglas.
        await queryRunner.query(`
            INSERT INTO "cierres" ("denuncia_id", "ci_hash_denunciante", "ci_hash_persona_buscada",
                                   "tipo_cierre", "bloquea_nueva_denuncia", "creado_en")
            SELECT "denuncia_id", "ci_hash_denunciante", "ci_hash_persona_buscada",
                   'CON_SANCION', true, "desactivada_en"
              FROM "desactivaciones"
        `);
        await queryRunner.query(`
            INSERT INTO "faltas" ("usuario_id", "tipo", "denuncia_id", "creada_en")
            SELECT d."denunciante_id", 'CIERRE_CON_SANCION', x."denuncia_id", x."desactivada_en"
              FROM "desactivaciones" x
              JOIN "denuncias" d ON d."id" = x."denuncia_id"
            ON CONFLICT DO NOTHING
        `);

        // --- solo inserción (I11) -------------------------------------------
        // TRUNCATE no dispara reglas por fila: las pruebas siguen pudiendo vaciar
        // las tablas entre casos, y nada del código usa TRUNCATE.
        await queryRunner.query(`
            CREATE OR REPLACE FUNCTION impedir_modificar_historial_sanciones()
            RETURNS TRIGGER AS $$
            BEGIN
                RAISE EXCEPTION
                  'La tabla % es de solo inserción (invariante I11): no puede modificarse ni eliminarse.',
                  TG_TABLE_NAME
                  USING ERRCODE = 'restrict_violation';
            END;
            $$ LANGUAGE plpgsql;
        `);
        await queryRunner.query(`
            CREATE TRIGGER trg_cierres_solo_insercion
            BEFORE UPDATE OR DELETE ON "cierres"
            FOR EACH ROW EXECUTE FUNCTION impedir_modificar_historial_sanciones()
        `);
        await queryRunner.query(`
            CREATE TRIGGER trg_faltas_solo_insercion
            BEFORE UPDATE OR DELETE ON "faltas"
            FOR EACH ROW EXECUTE FUNCTION impedir_modificar_historial_sanciones()
        `);

        // --- cuentas -------------------------------------------------------
        await queryRunner.query(`UPDATE "users" SET "estado_cuenta" = 'ACTIVA' WHERE "estado_cuenta" = 'RESTRINGIDA'`);
        // TypeORM compara los CHECK por nombre, así que no detecta este cambio
        // de expresión: se reescribe a mano.
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_estado_cuenta"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "chk_users_estado_cuenta" CHECK (((estado_cuenta)::text = ANY ((ARRAY['ACTIVA'::character varying, 'SUSPENDIDA'::character varying])::text[])))`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "reputation_score"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "restringida_hasta"`);

        // --- lo que reemplaza el régimen -----------------------------------
        await queryRunner.query(`DROP TABLE "reputation_events"`);
        await queryRunner.query(`DROP TABLE "desactivaciones"`);

        // --- una denuncia abierta por denunciante y persona -----------------
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_denuncias_abierta_por_persona" ON "denuncias" ("denunciante_id", "ci_hash_persona_buscada") WHERE "estado" IN ('ACTIVA', 'CADUCADA')`);

        // --- texto legal v2 ------------------------------------------------
        // La v1 sigue en la tabla: las declaraciones ya firmadas la referencian.
        // Primero se retira la vigente, porque el índice permite solo una.
        const hash = createHash('sha256').update(TEXTO_LEGAL_V2, 'utf8').digest('hex');
        await queryRunner.query(`UPDATE "versiones_texto_legal" SET "vigente" = false WHERE "vigente" = true`);
        await queryRunner.query(
            `INSERT INTO "versiones_texto_legal" ("version", "texto", "hash_texto", "vigente")
             VALUES ($1, $2, $3, true)
             ON CONFLICT ("version") DO UPDATE SET "vigente" = true`,
            [VERSION_REGIMEN_FALTAS, TEXTO_LEGAL_V2, hash],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Texto legal: vuelve a regir la v1. La v2 se borra solo si nadie firmó
        // con ella; si alguien lo hizo, queda —no vigente— porque su declaración
        // la referencia.
        await queryRunner.query(`UPDATE "versiones_texto_legal" SET "vigente" = false WHERE "version" = $1`, [VERSION_REGIMEN_FALTAS]);
        await queryRunner.query(`UPDATE "versiones_texto_legal" SET "vigente" = true WHERE "version" = 'v1'`);
        await queryRunner.query(
            `DELETE FROM "versiones_texto_legal" v
              WHERE v."version" = $1
                AND NOT EXISTS (SELECT 1 FROM "declaraciones_juradas" d WHERE d."version_texto_legal_id" = v."id")`,
            [VERSION_REGIMEN_FALTAS],
        );

        await queryRunner.query(`DROP INDEX "public"."uq_denuncias_abierta_por_persona"`);

        // Las tablas del régimen anterior, en su forma final.
        await queryRunner.query(`CREATE TABLE "desactivaciones" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "denuncia_id" uuid NOT NULL, "ci_hash_denunciante" character varying(64) NOT NULL, "ci_hash_persona_buscada" character varying(64) NOT NULL, "desactivada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_c53e57c86ebc1e4a7c207410bf8" UNIQUE ("denuncia_id"), CONSTRAINT "PK_d34c131d41490e9a107f41f7d89" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_desactivaciones_persona_buscada" ON "desactivaciones" ("ci_hash_persona_buscada") `);
        await queryRunner.query(`CREATE INDEX "idx_desactivaciones_denunciante" ON "desactivaciones" ("ci_hash_denunciante") `);
        await queryRunner.query(`ALTER TABLE "desactivaciones" ADD CONSTRAINT "FK_c53e57c86ebc1e4a7c207410bf8" FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "reputation_events" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "delta" integer NOT NULL, "reason" character varying(100) NOT NULL, "reference_id" uuid, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_27bf0668993ad863b678979548a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "reputation_events" ADD CONSTRAINT "FK_293465173241c39135fe3d9f4b2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        // En el régimen anterior, toda denuncia retirada tenía su desactivación,
        // así que vuelven todos los cierres, de los dos tipos. Las faltas no
        // tienen equivalente: el régimen anterior no las conocía.
        await queryRunner.query(`
            INSERT INTO "desactivaciones" ("denuncia_id", "ci_hash_denunciante", "ci_hash_persona_buscada", "desactivada_en")
            SELECT "denuncia_id", "ci_hash_denunciante", "ci_hash_persona_buscada", "creado_en" FROM "cierres"
        `);

        await queryRunner.query(`ALTER TABLE "users" ADD "restringida_hasta" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "users" ADD "role" character varying(20) NOT NULL DEFAULT 'citizen'`);
        await queryRunner.query(`ALTER TABLE "users" ADD "reputation_score" integer NOT NULL DEFAULT '100'`);
        await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT "chk_users_estado_cuenta"`);
        await queryRunner.query(`ALTER TABLE "users" ADD CONSTRAINT "chk_users_estado_cuenta" CHECK (((estado_cuenta)::text = ANY ((ARRAY['ACTIVA'::character varying, 'RESTRINGIDA'::character varying, 'SUSPENDIDA'::character varying])::text[])))`);

        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_faltas_solo_insercion ON "faltas"`);
        await queryRunner.query(`DROP TRIGGER IF EXISTS trg_cierres_solo_insercion ON "cierres"`);
        await queryRunner.query(`DROP FUNCTION IF EXISTS impedir_modificar_historial_sanciones()`);
        await queryRunner.query(`ALTER TABLE "cierres" DROP CONSTRAINT "FK_f09952be05884d2f17fb7f219d6"`);
        await queryRunner.query(`ALTER TABLE "faltas" DROP CONSTRAINT "FK_353453e753073b02b28b4f19459"`);
        await queryRunner.query(`ALTER TABLE "faltas" DROP CONSTRAINT "FK_9b6d0745cf62c168674798bf726"`);
        await queryRunner.query(`DROP INDEX "public"."idx_cierres_denunciante_persona"`);
        await queryRunner.query(`DROP TABLE "cierres"`);
        await queryRunner.query(`DROP TABLE "faltas"`);
    }
}
