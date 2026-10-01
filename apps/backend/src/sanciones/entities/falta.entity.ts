import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Denuncia } from '../../denuncias/entities/denuncia.entity';

/**
 * Por ahora, una sola: que la persona reportada declarara falsa la denuncia.
 *
 * Es un tipo y no un booleano para que el historial diga qué hecho produjo cada
 * falta, y para que agregar otra fuente sea una decisión explícita.
 */
export type TipoFalta = 'CIERRE_CON_SANCION';

/**
 * Historial de faltas de una cuenta.
 *
 * Es **de solo inserción** (I11): un disparador de la base rechaza cualquier
 * UPDATE o DELETE. Si una falta se pudiera borrar, la sanción dependería de que
 * nadie la borrara. Las faltas no vencen: solo nacen de una denuncia declarada
 * falsa por la persona afectada, que es exactamente el uso indebido que el
 * sistema no puede dejar pasar.
 */
@Entity('faltas')
// Hace idempotente la generación: el mismo hecho no produce dos faltas.
@Unique('uq_faltas_usuario_tipo_denuncia', ['usuario_id', 'tipo', 'denuncia_id'])
@Check('chk_faltas_tipo', `((tipo)::text = 'CIERRE_CON_SANCION'::text)`)
export class Falta {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** La cuenta sancionada. */
  @Column({ type: 'uuid' })
  usuario_id!: string;

  @Column({ type: 'varchar', length: 40 })
  tipo!: TipoFalta;

  /** El hecho que la originó. */
  @Column({ type: 'uuid' })
  denuncia_id!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;

  /**
   * NO ACTION y no CASCADE: borrar una cuenta o una denuncia no puede llevarse
   * por delante el historial de faltas.
   */
  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: User;

  @ManyToOne(() => Denuncia, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
