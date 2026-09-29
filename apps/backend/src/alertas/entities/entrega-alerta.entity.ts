import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { EmisionAlerta } from './emision-alerta.entity';

/**
 * El recorrido de una notificación, hasta donde se puede seguir.
 *
 *  - `encolada`: la fila existe; la pasarela todavía no respondió por ese teléfono.
 *  - `aceptada`: Expo tomó el mensaje y dio un ticket. Todavía no se sabe más.
 *  - `fallida`: Expo la rechazó al enviarla, o no se le pudo hablar.
 *  - `despachada`: el recibo dice que Apple o Google la recibieron. Es lo más
 *    lejos que se puede saber: el último tramo, de Apple o Google al teléfono,
 *    no lo informa nadie.
 *  - `no_despachada`: el recibo trae un error; Apple o Google no la tomaron.
 *  - `sin_recibo`: no se obtuvo recibo en las 24 horas en que Expo los guarda.
 *    Resultado desconocido: se cuenta aparte, ni como éxito ni como fallo.
 */
export type EstadoEntrega =
  | 'encolada'
  | 'aceptada'
  | 'fallida'
  | 'despachada'
  | 'no_despachada'
  | 'sin_recibo';

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
// Solo las que esperan recibo, que son pocas; el histórico resuelto no entra.
// Va sobre `id` porque el worker las recorre en ese orden, por páginas.
@Index('idx_entregas_esperando_recibo', ['id'], {
  where: `"estado" = 'aceptada'`,
})
// Escrita tal como Postgres la normaliza, para que `migration:generate` no
// proponga recrearla en cada ejecución.
@Check(
  'chk_entregas_estado',
  `((estado)::text = ANY ((ARRAY['encolada'::character varying, 'aceptada'::character varying, 'fallida'::character varying, 'despachada'::character varying, 'no_despachada'::character varying, 'sin_recibo'::character varying])::text[]))`,
)
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

  /** Ticket que dio Expo al aceptar: la única llave para pedir el recibo. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  ticket_id!: string | null;

  /** Lo que dijo el recibo: `ok`, o el error de Apple, Google o Expo. */
  @Column({ type: 'text', nullable: true })
  resultado_recibo!: string | null;

  /**
   * Cuándo se resolvió el recibo.
   *
   * Va aparte de `actualizada_en` a propósito: esa marca es la que mide la
   * latencia de envío, y moverla cuando llega el recibo —quince minutos
   * después— falsearía esa medición.
   */
  @Column({ type: 'timestamptz', nullable: true })
  recibo_en!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  actualizada_en!: Date;

  @ManyToOne(() => EmisionAlerta, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'emision_id' })
  emision!: EmisionAlerta;
}
