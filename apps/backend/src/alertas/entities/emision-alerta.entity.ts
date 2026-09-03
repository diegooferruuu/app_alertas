import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Denuncia } from '../../denuncias/entities/denuncia.entity';

/** Por qué se emitió esta alerta. */
export type MotivoEmision = 'firma' | 'corroboracion';

export type EstadoEmision = 'pendiente' | 'procesando' | 'completada' | 'fallida';

/**
 * Una emisión de alerta: el trabajo de avisar a una zona.
 *
 * Cumple dos papeles a la vez, y es deliberado:
 *
 * 1. **Es la cola.** La fila se crea en la misma transacción que la firma que la
 *    origina. Eso hace imposible el caso que rompería el sistema en silencio:
 *    una denuncia firmada cuya alerta nunca se encoló porque el intermediario
 *    falló entre una operación y otra. O se guardan las dos cosas o ninguna.
 *
 * 2. **Es el registro de lo ocurrido.** Guarda el radio vigente al emitir y a
 *    cuánta gente alcanzó, que es lo que permite medir después la precisión de
 *    la segmentación.
 *
 * Enviar dentro de la petición HTTP no era viable: alcanzar a cientos de
 * destinatarios agota el tiempo de espera del cliente y no admite reintento.
 */
@Entity('emisiones_alerta')
@Index('idx_emisiones_denuncia', ['denuncia_id'])
// Índice parcial para que el worker encuentre lo pendiente sin recorrer el
// histórico completo, que solo crece.
@Index('idx_emisiones_pendientes', ['estado'], {
  where: `"estado" IN ('pendiente', 'procesando')`,
})
export class EmisionAlerta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denuncia_id!: string;

  /** El radio vigente en el momento de emitir, no el actual de la denuncia. */
  @Column({ type: 'integer' })
  radio_m!: number;

  @Column({ type: 'varchar', length: 20 })
  motivo!: MotivoEmision;

  @Column({ type: 'varchar', length: 20, default: 'pendiente' })
  estado!: EstadoEmision;

  /** Cuántos destinatarios devolvió la consulta. Nulo hasta procesarse. */
  @Column({ type: 'integer', nullable: true })
  destinatarios!: number | null;

  @Column({ type: 'integer', default: 0 })
  intentos!: number;

  @Column({ type: 'text', nullable: true })
  ultimo_error!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;

  /**
   * Cuándo se procesó realmente.
   *
   * La diferencia con `creada_en` es la latencia entre firmar y alertar, que es
   * la métrica central de un sistema de alerta temprana.
   */
  @Column({ type: 'timestamptz', nullable: true })
  emitida_en!: Date | null;

  @ManyToOne(() => Denuncia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
