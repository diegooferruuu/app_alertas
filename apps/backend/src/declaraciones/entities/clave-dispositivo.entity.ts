import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/**
 * La clave pública Ed25519 de un teléfono, con la que firma sus declaraciones.
 *
 * La privada nunca sale del teléfono: la genera ahí, la guarda en su almacén
 * seguro y solo se usa después de que la persona lo desbloquea. Al servidor
 * llega únicamente esta mitad, que alcanza para verificar.
 *
 * Es de **solo inserción**, con un disparador en la base: una declaración
 * firmada apunta a su clave, y si la clave se pudiera cambiar o borrar, esa
 * firma dejaría de poder verificarse. Un teléfono nuevo registra una clave
 * nueva; las viejas se quedan.
 */
@Entity('claves_dispositivo')
@Index('idx_claves_dispositivo_usuario', ['usuario_id'])
// En la base, no solo en el DTO: la verificación espera exactamente 32 bytes.
@Check('chk_claves_dispositivo_formato', `((clave_publica)::text ~ '^[0-9a-f]{64}$'::text)`)
export class ClaveDispositivo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  /** Los 32 bytes de la clave, en hexadecimal minúscula. Única en el sistema. */
  @Column({ type: 'varchar', length: 64, unique: true })
  clave_publica!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;

  /** NO ACTION: borrar la cuenta no puede llevarse las claves de sus firmas. */
  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: User;
}
