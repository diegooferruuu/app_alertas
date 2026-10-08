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
 *
 * Con `soloDifusion` deja en pie el aviso directo a la persona reportada: no es
 * una difusión por zona, y enterarse de que la denuncia sigue a la vista le
 * sirve para retirarla.
 */
export async function revocarEmisionesPendientes(
  manager: EntityManager,
  denunciaId: string,
  razon: string,
  { soloDifusion = false }: { soloDifusion?: boolean } = {},
): Promise<void> {
  const consulta = manager
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
    .andWhere("estado IN ('pendiente', 'procesando')");

  if (soloDifusion) consulta.andWhere("motivo <> 'coincidencia_documento'");

  await consulta.execute();
}
