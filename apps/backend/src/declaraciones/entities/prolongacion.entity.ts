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
import { Denuncia } from '../../denuncias/entities/denuncia.entity';
import { ClaveDispositivo } from './clave-dispositivo.entity';
import { VersionTextoLegal } from './version-texto-legal.entity';

/**
 * Una prolongación de la alerta, firmada con el teléfono de quien la presentó.
 *
 * Prolongar es afirmar de nuevo que la persona sigue sin aparecer, bajo el mismo
 * juramento: el texto legal lo dice, y la firma cubre su hash. Por eso no basta
 * con tocar un botón. Sin firma, una alerta falsa se mantendría viva sin que
 * nadie respondiera por ella.
 *
 * No notifica a nadie: mantiene la alerta a la vista —mapa, lista,
 * avistamientos— por un plazo más.
 *
 * Es de **solo inserción**, con un disparador en la base, como las declaraciones:
 * una firma que se pudiera borrar no atribuiría nada.
 */
@Entity('prolongaciones')
// Un número por denuncia: dos prolongaciones simultáneas no pueden pasar las
// dos el tope.
@Index('uq_prolongaciones_denuncia_numero', ['denuncia_id', 'numero'], { unique: true })
@Check('chk_prolongaciones_numero', `(numero >= 1)`)
@Check('chk_prolongaciones_firma', `((firma_dispositivo)::text ~ '^[0-9a-f]{128}$'::text)`)
export class Prolongacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denuncia_id!: string;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  /** Primera, segunda… Entra en lo firmado, así una firma no sirve para otra. */
  @Column({ type: 'smallint' })
  numero!: number;

  /** El texto legal vigente al prolongar, cuyo hash firmó el teléfono. */
  @Column({ type: 'uuid' })
  version_texto_legal_id!: string;

  @Column({ type: 'varchar', length: 64 })
  hash_texto_legal!: string;

  @Column({ type: 'uuid' })
  clave_dispositivo_id!: string;

  /** Ed25519 sobre `mensajeDeProlongacion`, en hexadecimal. */
  @Column({ type: 'varchar', length: 128 })
  firma_dispositivo!: string;

  /** Hasta cuándo quedó la alerta con esta prolongación. */
  @Column({ type: 'timestamptz' })
  expira_en!: Date;

  /** La pone el servidor. */
  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;

  /** NO ACTION, como las declaraciones: borrar la denuncia no se lleva sus firmas. */
  @ManyToOne(() => Denuncia, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: User;

  @ManyToOne(() => ClaveDispositivo, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'clave_dispositivo_id' })
  clave!: ClaveDispositivo;

  @ManyToOne(() => VersionTextoLegal)
  @JoinColumn({ name: 'version_texto_legal_id' })
  version_texto_legal!: VersionTextoLegal;
}
