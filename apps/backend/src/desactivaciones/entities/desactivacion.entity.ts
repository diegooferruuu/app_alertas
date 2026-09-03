import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Denuncia } from '../../denuncias/entities/denuncia.entity';

/**
 * Registro de que alguien retiró una alerta que lo identificaba.
 *
 * Es a la vez el rastro de auditoría de la acción y la base sobre la que se
 * detecta la reincidencia: dos desactivaciones recibidas por la misma cuenta, o
 * dos denuncias contra la misma persona, no admiten lectura de buena fe.
 *
 * Guarda hashes y no identidades porque para detectar el patrón basta comparar:
 * quién es cada quién solo se revela por la vía deliberada de la constancia.
 *
 * No se borra: si se pudiera, bastaría con eliminar el registro para volver a
 * empezar de cero y la sanción graduada dejaría de significar nada.
 */
@Entity('desactivaciones')
@Index('idx_desactivaciones_denunciante', ['ci_hash_denunciante'])
@Index('idx_desactivaciones_persona_buscada', ['ci_hash_persona_buscada'])
export class Desactivacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Única: una denuncia solo puede desactivarse una vez. */
  @Column({ type: 'uuid', unique: true })
  denuncia_id!: string;

  /** A quién se le imputa: es quien firmó la denuncia retirada. */
  @Column({ type: 'varchar', length: 64 })
  ci_hash_denunciante!: string;

  /**
   * Contra quién iba la denuncia.
   *
   * Permite distinguir la reincidencia dirigida —denunciar dos veces a la misma
   * persona— de dos desactivaciones inconexas, que el diseño trata distinto.
   */
  @Column({ type: 'varchar', length: 64 })
  ci_hash_persona_buscada!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  desactivada_en!: Date;

  /**
   * NO ACTION y no CASCADE: borrar la denuncia no puede llevarse por delante la
   * constancia de que alguien la retiró. Como las denuncias tampoco se borran
   * (invariante I7), en la práctica la llave impide ambas cosas a la vez.
   */
  @ManyToOne(() => Denuncia, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
