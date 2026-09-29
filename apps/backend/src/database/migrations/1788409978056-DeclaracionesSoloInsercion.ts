import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Invariante I4: el paquete probatorio es append-only.
 *
 * «No debe existir ninguna ruta de código que actualice o elimine filas de esa
 * tabla, ni siquiera para un moderador.»
 *
 * Que el código no lo haga hoy no basta. Un invariante que solo sostiene la
 * disciplina de quien escribe se rompe en el primer refactor, y aquí lo que está
 * en juego es la credibilidad entera del registro: una declaración que puede
 * editarse después no prueba nada, porque cualquiera podría cambiar lo que dijo
 * haber declarado. Peor, quien opera el servidor podría reescribir la historia
 * sin dejar rastro.
 *
 * El disparador lo impone la base de datos, así que se aplica también a un
 * `UPDATE` escrito a mano en una consola de Postgres, no solo a lo que pase por
 * la aplicación.
 *
 * Corregir un error en una declaración no es editarla: es firmar una nueva. La
 * anterior queda, porque también es parte de lo que ocurrió.
 */
export class DeclaracionesSoloInsercion1788409978056 implements MigrationInterface {
  name = 'DeclaracionesSoloInsercion1788409978056';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // --- Limpieza previa, antes de que exista el disparador ---
    //
    // La tabla nació sin llave foránea, así que pudo quedar alguna declaración
    // apuntando a una denuncia que ya no existe. Hay que resolverlo antes de
    // añadir la restricción, y antes de crear el disparador, que bloquearía el
    // borrado.
    //
    // Suprimir una declaración del medio de la cadena rompería la verificación
    // de todas las posteriores. Por eso la limpieza solo procede si TODAS son
    // huérfanas —residuo de pruebas—; si hubiera alguna legítima, la migración
    // se detiene para que lo resuelva una persona en lugar de romper la cadena
    // en silencio.
    const [{ total, huerfanas }] = await queryRunner.query(`
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (
          WHERE NOT EXISTS (SELECT 1 FROM "denuncias" n WHERE n.id = d.denuncia_id)
        )::int AS huerfanas
      FROM "declaraciones_juradas" d
    `);

    if (huerfanas > 0) {
      if (huerfanas !== total) {
        throw new Error(
          `Hay ${huerfanas} declaraciones huérfanas junto a ${total - huerfanas} válidas. ` +
            'Borrar las huérfanas rompería la cadena de hashes de las posteriores. ' +
            'Resuélvelo a mano antes de aplicar esta migración.',
        );
      }
      await queryRunner.query(`DELETE FROM "declaraciones_juradas"`);
    }

    // Integridad referencial sin cascada: borrar una denuncia con declaraciones
    // debe fallar. Con ON DELETE CASCADE, eliminar la denuncia se llevaría por
    // delante su paquete probatorio y burlaría el invariante por la puerta de
    // atrás. Las denuncias tampoco se borran (I7), así que esto solo cierra el
    // camino indirecto: borrar la cuenta de quien denunció.
    await queryRunner.query(`
      ALTER TABLE "declaraciones_juradas"
      ADD CONSTRAINT "FK_bfb5d16915b5f198cf5ddf0e2d5"
      FOREIGN KEY ("denuncia_id") REFERENCES "denuncias"("id")
      ON DELETE NO ACTION ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION impedir_modificar_declaraciones()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION
          'Las declaraciones juradas son de solo inserción (invariante I4): no pueden modificarse ni eliminarse. Para corregir una declaración se firma una nueva.'
          USING ERRCODE = 'restrict_violation';
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_declaraciones_solo_insercion
      BEFORE UPDATE OR DELETE ON "declaraciones_juradas"
      FOR EACH ROW EXECUTE FUNCTION impedir_modificar_declaraciones();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "declaraciones_juradas" DROP CONSTRAINT "FK_bfb5d16915b5f198cf5ddf0e2d5"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_declaraciones_solo_insercion ON "declaraciones_juradas"`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS impedir_modificar_declaraciones()`);
  }
}
