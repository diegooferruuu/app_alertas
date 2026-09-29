import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Invariante I6: el OCR extrae datos, no autentica.
 *
 * `identity_verified` afirmaba que la identidad había sido verificada, cosa que
 * el sistema no puede establecer — no existe API pública de consulta al registro
 * de identificación. Lo único cierto es que la persona registró un documento.
 *
 * Se usa RENAME y no DROP + ADD para conservar los datos existentes.
 */
export class RenombrarDocumentoRegistrado1788234292712
  implements MigrationInterface
{
  name = 'RenombrarDocumentoRegistrado1788234292712';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "identity_verified" TO "documento_registrado"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "identity_verified_at" TO "documento_registrado_en"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "documento_registrado_en" TO "identity_verified_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" RENAME COLUMN "documento_registrado" TO "identity_verified"`,
    );
  }
}
