import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EmisionAlerta } from './emision-alerta.entity';

export type EstadoEntrega = 'encolada' | 'aceptada' | 'fallida';

/**
 * Una alerta enviada a un dispositivo concreto.
 *
 * Sin esta tabla el sistema no tiene nada que medir, y sin medición no hay
 * validación que presentar: no se podría afirmar a cuánta gente llegó una
 * alerta, en cuánto tiempo, ni si la segmentación por cercanía funcionó.
 *
 * `distancia_m` es la que permite la comprobación que de verdad importa: que
 * nadie dentro del radio quedó sin notificar y que nadie fuera fue notificado.
 * Guardarla al emitir —y no calcularla después— es necesario porque la persona
 * se mueve: recalcularla mañana daría otro número.
 */
@Entity('entregas_alerta')
// Una sola entrega por teléfono en cada emisión. Es lo que permite reintentar
// una emisión que falló a mitad sin volver a notificar a quien ya consta como
// notificado. Como empieza por `emision_id`, sirve también para buscar las
// entregas de una emisión.
@Index('uq_entregas_emision_dispositivo', ['emision_id', 'dispositivo_id'], {
  unique: true,
})
@Index('idx_entregas_usuario', ['usuario_id'])
export class EntregaAlerta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  emision_id!: string;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  @Column({ type: 'uuid' })
  dispositivo_id!: string;

  /** Distancia al punto del caso en el momento de emitir. */
  @Column({ type: 'integer' })
  distancia_m!: number;

  @Column({ type: 'varchar', length: 20, default: 'encolada' })
  estado!: EstadoEntrega;

  /** Lo que respondió la pasarela, para diagnosticar un fallo concreto. */
  @Column({ type: 'text', nullable: true })
  resultado_pasarela!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizada_en!: Date;

  @ManyToOne(() => EmisionAlerta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'emision_id' })
  emision!: EmisionAlerta;
}
