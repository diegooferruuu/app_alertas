import { MigrationInterface, QueryRunner } from 'typeorm';
import { createHash } from 'crypto';
import { TEXTO_LEGAL_V1, VERSION_INICIAL } from '../../declaraciones/texto-legal';

/**
 * Texto legal versionado de la declaración jurada.
 *
 * Si el texto cambia dentro de seis meses, un caso de hoy tiene que poder
 * demostrar qué decía exactamente cuando la persona lo aceptó. Por eso cada
 * declaración referenciará una versión en lugar de copiar el texto.
 *
 * Siembra la primera versión: sin ninguna vigente el sistema no puede recibir
 * declaraciones juradas, así que forma parte del esquema, no de datos de prueba.
 */

export class TextoLegalVersionado1788393611344 implements MigrationInterface {
    name = 'TextoLegalVersionado1788393611344'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "versiones_texto_legal" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "version" character varying(20) NOT NULL, "texto" text NOT NULL, "hash_texto" character varying(64) NOT NULL, "vigente" boolean NOT NULL DEFAULT false, "creada_en" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_bfd76be218435b53a16ac338a98" UNIQUE ("version"), CONSTRAINT "PK_d7809e42d7c277cf2df165f2b89" PRIMARY KEY ("id"))`);
        // ÚNICO y parcial: garantiza que solo una versión esté vigente a la vez.
        // Sin la unicidad, dos vigentes harían indeterminado qué texto se muestra.
        await queryRunner.query(
          `CREATE UNIQUE INDEX "idx_versiones_texto_legal_vigente" ON "versiones_texto_legal" ("vigente") WHERE "vigente" = true`,
        );

        const hash = createHash('sha256').update(TEXTO_LEGAL_V1, 'utf8').digest('hex');
        await queryRunner.query(
          `INSERT INTO "versiones_texto_legal" ("version", "texto", "hash_texto", "vigente")
           VALUES ($1, $2, $3, true)`,
          [VERSION_INICIAL, TEXTO_LEGAL_V1, hash],
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."idx_versiones_texto_legal_vigente"`);
        await queryRunner.query(`DROP TABLE "versiones_texto_legal"`);
    }

}
