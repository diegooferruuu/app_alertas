import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aviso directo a la persona que una denuncia identifica (H4.1).
 *
 * Una emisión pasa a poder apuntar a alguien concreto en lugar de a una zona:
 * `usuario_objetivo_id` la convierte en un aviso personal, y por eso `radio_m`
 * se vuelve opcional — ahí no hay zona que alcanzar.
 *
 * Reutiliza la cola y el registro de entregas en lugar de abrir un camino
 * paralelo: es el mismo problema —enviar fuera de la petición, con reintento y
 * medición— y duplicarlo habría significado mantener dos.
 */

export class AvisoPorCoincidencia1788412547191 implements MigrationInterface {
    name = 'AvisoPorCoincidencia1788412547191'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" ADD "usuario_objetivo_id" uuid`);
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" ALTER COLUMN "radio_m" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" ALTER COLUMN "radio_m" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "emisiones_alerta" DROP COLUMN "usuario_objetivo_id"`);
    }

}
