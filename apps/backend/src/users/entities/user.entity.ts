import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany, Unique } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { ReputationEvent } from './reputation-event.entity';

@Entity('users')
@Index('idx_users_email', ['email'])
@Index('idx_users_ci_hash', ['ci_hash'])
@Index('idx_users_push_token', ['push_token'], { where: '"push_token" IS NOT NULL' })
@Unique(['ci_hash'])
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 120 })
  full_name!: string;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone!: string;

  @Column({ type: 'varchar', length: 255 })
  password_hash!: string;

  // Identity verification
  @Column({ type: 'boolean', default: false })
  identity_verified!: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ci_hash!: string;

  @Column({ type: 'timestamptz', nullable: true })
  identity_verified_at!: Date;

  // Reputation system
  @Column({ type: 'integer', default: 100 })
  reputation_score!: number;

  @Column({ type: 'boolean', default: false })
  is_suspended!: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  suspended_at!: Date;

  @Column({ type: 'text', nullable: true })
  suspension_reason!: string;

  // Push notifications
  @Column({ type: 'varchar', length: 255, nullable: true })
  push_token!: string;

  @Column({ type: 'timestamptz', nullable: true })
  push_token_updated_at!: Date;

  // Location (PostGIS)
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  last_location!: string;

  @Column({ type: 'timestamptz', nullable: true })
  last_location_at!: Date;

  // Role
  @Column({ type: 'varchar', length: 20, default: 'citizen' })
  role!: 'citizen' | 'admin';

  // Audit
  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @Column({ type: 'timestamptz', nullable: true })
  deleted_at!: Date;

  // Relations
  @OneToMany(() => RefreshToken, (token) => token.user)
  refresh_tokens!: RefreshToken[];

  @OneToMany(() => ReputationEvent, (event) => event.user)
  reputation_events!: ReputationEvent[];
}
