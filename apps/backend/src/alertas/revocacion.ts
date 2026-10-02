import { EntityManager } from 'typeorm';
import { EmisionAlerta } from './entities/emision-alerta.entity';

/**
 * Da por terminadas, sin enviarlas, las emisiones de una denuncia que todavía
 * no salieron.
 *
 * El worker relee el estado de la denuncia antes de enviar y ya las
 * descartaría, pero dejarlas pendientes le haría reintentar en cada ciclo un
 * envío que nunca debe ocurrir. Recibe la transacción de quien detiene la
 * alerta: una detención a medias dejaría la alerta saliendo justo cuando se
 * pidió que parara.
 */
export async function revocarEmisionesPendientes(
  manager: EntityManager,
  denunciaId: string,
  razon: string,
): Promise<void> {
  await manager
    .getRepository(EmisionAlerta)
    .createQueryBuilder()
    .update(EmisionAlerta)
    .set({
      estado: 'completada',
      destinatarios: 0,
      emitida_en: () => 'now()',
      ultimo_error: `revocada: ${razon}`,
    })
    .where('denuncia_id = :id', { id: denunciaId })
    .andWhere("estado IN ('pendiente', 'procesando')")
    .execute();
}
