import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('reputation_events')
export class ReputationEvent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  user_id!: string;

  @Column({ type: 'integer' })
  delta!: number;

  @Column({ type: 'varchar', length: 100 })
  reason!: string;

  @Column({ type: 'uuid', nullable: true })
  reference_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  // Sin @JoinColumn, TypeORM crea una columna "userId" aparte y cuelga de ella
  // la llave foránea, dejando sin proteger la user_id que escribe el código.
  @ManyToOne(() => User, (user) => user.reputation_events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: User;
}
