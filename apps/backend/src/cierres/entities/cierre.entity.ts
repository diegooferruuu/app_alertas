import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { Denuncia } from '../../denuncias/entities/denuncia.entity';

/**
 * Las dos formas de cerrar una alerta que tiene la persona reportada.
 *
 *  - «Estoy bien»: la alerta se retira y nadie recibe falta. Una desaparición
 *    real que terminó bien no castiga a quien la denunció.
 *  - «Esta denuncia es falsa»: además, quien denunció recibe una falta.
 */
export enum TipoCierre {
  SIN_SANCION = 'SIN_SANCION',
  CON_SANCION = 'CON_SANCION',
}

/**
 * Registro de que la persona reportada cerró una alerta sobre sí misma.
 *
 * Es el rastro de auditoría del cierre y la base de dos reglas: la suspensión
 * —que cuenta personas distintas que declararon falsas las denuncias de una
 * cuenta— y el bloqueo de volver a denunciar a la misma persona.
 *
 * Guarda hashes y no identidades: para aplicar las reglas basta comparar, y
 * quién es cada quién solo se revela por la vía deliberada de la constancia.
 *
 * Es **de solo inserción** (I11), con un disparador en la base: si un cierre se
 * pudiera borrar, bastaría con eso para volver a empezar de cero.
 */
@Entity('cierres')
// Sirve a las dos consultas: todos los cierres de un denunciante, y los de un
// denunciante sobre una persona concreta.
@Index('idx_cierres_denunciante_persona', ['ci_hash_denunciante', 'ci_hash_persona_buscada'])
@Check(
  'chk_cierres_tipo',
  `((tipo_cierre)::text = ANY ((ARRAY['SIN_SANCION'::character varying, 'CON_SANCION'::character varying])::text[]))`,
)
// Una denuncia declarada falsa siempre bloquea volver a denunciar a esa
// persona; con «Estoy bien», lo decide quien cierra.
@Check(
  'chk_cierres_falsa_bloquea',
  `(((tipo_cierre)::text <> 'CON_SANCION'::text) OR bloquea_nueva_denuncia)`,
)
export class Cierre {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Única: una denuncia se cierra una sola vez. */
  @Column({ type: 'uuid', unique: true })
  denuncia_id!: string;

  @Column({ type: 'varchar', length: 64 })
  ci_hash_denunciante!: string;

  @Column({ type: 'varchar', length: 64 })
  ci_hash_persona_buscada!: string;

  @Column({ type: 'varchar', length: 20 })
  tipo_cierre!: TipoCierre;

  /**
   * Si quien denunció ya no puede volver a denunciar a esta persona.
   *
   * Que el bloqueo exista tras los dos tipos de cierre es lo que impide que un
   * rechazo posterior revele cuál de los dos eligió la persona.
   */
  @Column({ type: 'boolean' })
  bloquea_nueva_denuncia!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creado_en!: Date;

  /**
   * NO ACTION: borrar la denuncia no puede llevarse el registro de su cierre.
   * Como las denuncias tampoco se borran (I7), en la práctica impide ambas cosas.
   */
  @ManyToOne(() => Denuncia, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
