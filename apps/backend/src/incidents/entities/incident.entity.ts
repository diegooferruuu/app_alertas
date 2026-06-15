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
import { User } from '../../users/entities/user.entity';

export type IncidentCategory = 'desaparicion';

export type IncidentStatus = 'activo' | 'verificado' | 'resuelto' | 'descartado';

@Entity('incidents')
@Index('idx_incidents_created_at', ['created_at'])
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  reporter_id!: string;

  @Column({ type: 'varchar', length: 40 })
  category!: IncidentCategory;

  @Column({ type: 'text' })
  description!: string;

  // Coordenadas planas (fáciles de leer para pintar markers en el mapa)
  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  // Foto opcional del incidente (base64 por ahora; migrar a object storage en Fase 4)
  @Column({ type: 'text', nullable: true })
  photo_base64!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'activo' })
  status!: IncidentStatus;

  @Column({ type: 'integer', default: 0 })
  confirmations_count!: number;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reporter_id' })
  reporter!: User;
}
