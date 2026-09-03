import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export type Plataforma = 'android' | 'ios';

/**
 * Dispositivo donde una persona recibe alertas.
 *
 * Antes era una sola columna `push_token` en la cuenta, de modo que quien usaba
 * dos teléfonos solo recibía la alerta en uno —y sin saber en cuál—. En un
 * sistema de alerta temprana eso es una pérdida directa de alcance.
 *
 * `plataforma` no es decorativa: es lo que permite medir la tasa de entrega
 * separada por sistema operativo, una de las métricas de validación. iOS y
 * Android tienen comportamientos de entrega distintos y mezclarlos escondería
 * un problema en uno de los dos.
 */
@Entity('dispositivos')
@Index('idx_dispositivos_usuario', ['usuario_id'])
export class Dispositivo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  /**
   * Único: un token identifica un dispositivo concreto.
   *
   * Si alguien reinstala la app o cambia de cuenta en el mismo teléfono, el
   * token se reasigna en lugar de duplicarse. Sin la unicidad, la persona
   * anterior seguiría recibiendo alertas en un aparato que ya no es suyo.
   */
  @Column({ type: 'varchar', length: 255, unique: true })
  push_token!: string;

  @Column({ type: 'varchar', length: 20 })
  plataforma!: Plataforma;

  /**
   * Última vez que el dispositivo dio señales de vida.
   *
   * Permite dejar de intentar el envío a aparatos abandonados, que de otro modo
   * ensuciarían la tasa de entrega con fallos que no dicen nada del sistema.
   */
  @Column({ type: 'timestamptz' })
  ultima_actividad!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  creado_en!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: User;
}
