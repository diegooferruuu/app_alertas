import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * H1.2 y H1.3 — Máquina de estados y documento de la persona buscada.
 *
 * Reemplaza `status` (activo/verificado/resuelto/descartado) por dos ejes
 * independientes: `nivel_confianza`, que mide el respaldo del caso y determina
 * alcance y plazo, y `estado`, que dice si la denuncia sigue viva.
 *
 * Sobre el borrado de filas previas: `ci_hash_persona_buscada` es obligatorio
 * porque es lo que permite a la persona reportada desactivar una denuncia falsa.
 * Una fila sin ese dato sería una denuncia que nadie puede revertir, es decir
 * exactamente el riesgo que este rediseño existe para cerrar. No hay forma de
 * completarlo retroactivamente —el dato nunca se pidió—, así que esas filas no
 * pueden sobrevivir. Se confirmó que las existentes son datos de prueba.
 */
export class MaquinaDeEstados1788304452680 implements MigrationInterface {
  name = 'MaquinaDeEstados1788304452680';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT COUNT(*)::int AS count FROM "denuncias"`,
    );
    if (count > 0) {
      // Ver el encabezado: no son recuperables porque el dato nunca existió.
      await queryRunner.query(`DELETE FROM "denuncias"`);
    }

    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "status"`);

    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "ci_hash_persona_buscada" character varying(64) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "nivel_confianza" character varying(20) NOT NULL DEFAULT 'REGISTRADA'`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "estado" character varying(20) NOT NULL DEFAULT 'ACTIVA'`,
    );
    await queryRunner.query(`ALTER TABLE "denuncias" ADD "radio_actual_m" integer`);
    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "expira_en" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "numero_caso_felcc" character varying(60)`,
    );

    // La fase 4 busca por este hash para saber si la persona autenticada es la
    // reportada. Sin índice, esa comprobación recorre la tabla entera.
    await queryRunner.query(
      `CREATE INDEX "idx_denuncias_ci_persona_buscada" ON "denuncias" ("ci_hash_persona_buscada")`,
    );

    // Los valores se validan en el dominio, pero la restricción evita que una
    // escritura directa a la base deje la máquina de estados en un valor que el
    // código no sabe interpretar.
    await queryRunner.query(`
      ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_nivel_confianza"
      CHECK ("nivel_confianza" IN ('REGISTRADA', 'PROVISIONAL', 'CORROBORADA'))
    `);
    await queryRunner.query(`
      ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_estado"
      CHECK ("estado" IN ('ACTIVA', 'CADUCADA', 'INVALIDADA', 'CERRADA'))
    `);

    // Una denuncia difundible tiene siempre radio y caducidad; una REGISTRADA
    // no tiene ninguno de los dos. Esto impide el estado intermedio incoherente
    // de una alerta emitida sin plazo de vencimiento.
    await queryRunner.query(`
      ALTER TABLE "denuncias" ADD CONSTRAINT "chk_denuncias_difusion_coherente"
      CHECK (
        ("nivel_confianza" = 'REGISTRADA' AND "radio_actual_m" IS NULL AND "expira_en" IS NULL)
        OR
        ("nivel_confianza" <> 'REGISTRADA' AND "radio_actual_m" IS NOT NULL AND "expira_en" IS NOT NULL)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_difusion_coherente"`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_estado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" DROP CONSTRAINT "chk_denuncias_nivel_confianza"`,
    );
    await queryRunner.query(`DROP INDEX "public"."idx_denuncias_ci_persona_buscada"`);
    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "numero_caso_felcc"`);
    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "expira_en"`);
    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "radio_actual_m"`);
    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "estado"`);
    await queryRunner.query(`ALTER TABLE "denuncias" DROP COLUMN "nivel_confianza"`);
    await queryRunner.query(
      `ALTER TABLE "denuncias" DROP COLUMN "ci_hash_persona_buscada"`,
    );
    await queryRunner.query(
      `ALTER TABLE "denuncias" ADD "status" character varying(20) NOT NULL DEFAULT 'activo'`,
    );
  }
}
