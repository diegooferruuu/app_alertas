import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany, Unique, Check } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { ReputationEvent } from './reputation-event.entity';

@Entity('users')
/**
 * Un documento registrado siempre tiene hash.
 *
 * El código ya escribe las dos columnas juntas, pero de eso depende algo que no
 * puede quedar en manos de una convención: el interruptor de desactivación
 * reconoce a la persona reportada comparando `ci_hash`. Una cuenta marcada como
 * verificada sin hash podría denunciar y jamás ser identificada como
 * denunciante, ni retirar una alerta sobre sí misma.
 */
@Check(
  'chk_users_documento_con_hash',
  `((documento_registrado = false) OR (ci_hash IS NOT NULL))`,
)
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

  // Documento de identidad registrado.
  // El OCR extrae datos, no autentica: el sistema NO establece que la persona
  // sea quien dice ser, solo que registró un documento con estos datos.
  @Column({ type: 'boolean', default: false })
  documento_registrado!: boolean;

  @Column({ type: 'varchar', length: 64, nullable: true })
  ci_hash!: string;

  @Column({ type: 'timestamptz', nullable: true })
  documento_registrado_en!: Date;

  /**
   * Nombre asociado al documento registrado.
   *
   * Es el nombre que la persona declaró y que se comprobó consistente con el
   * texto leído del carnet. No es un dato «extraído» en sentido estricto: el
   * OCR devuelve texto crudo del que no se puede aislar un nombre estructurado
   * de forma fiable, así que se conserva el declarado una vez contrastado.
   *
   * Existe para la confirmación escrita a mano de la declaración jurada: es el
   * dato contra el que se compara lo que la persona teclea al firmar. Sin él esa
   * comprobación no tendría referencia.
   */
  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre_documento!: string | null;

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

  // Última ubicación conocida (PostGIS). El índice GiST es imprescindible: la
  // difusión de una alerta consulta esta columna para saber a quién alcanza, y
  // sin índice esa consulta recorre la tabla entera de usuarios.
  @Index('idx_users_last_location', { spatial: true })
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
