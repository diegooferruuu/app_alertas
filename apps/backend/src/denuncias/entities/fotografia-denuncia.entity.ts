import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Denuncia } from './denuncia.entity';

/**
 * Fotografía de una denuncia, en tabla propia.
 *
 * Vivía dentro de la fila de `denuncias`, que es la tabla sobre la que corre la
 * consulta de proximidad —el mecanismo central del sistema—. Cada imagen en
 * base64 pesa cientos de kilobytes, así que engordaba precisamente las filas que
 * Postgres tiene que recorrer para decidir a quién alerta.
 *
 * Sacarla es además la corrección más barata que conserva la propiedad de no
 * depender de ningún servicio externo: la imagen sigue en nuestra base.
 */
@Entity('fotografias_denuncia')
@Index('idx_fotografias_denuncia', ['denuncia_id'])
export class FotografiaDenuncia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denuncia_id!: string;

  /**
   * Imagen en base64.
   *
   * `select: false` para que ninguna consulta la traiga sin pedirla
   * explícitamente: el motivo de existir de esta tabla es que este contenido no
   * viaje cuando no hace falta.
   */
  @Column({ type: 'text', select: false })
  contenido!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;

  @ManyToOne(() => Denuncia, (denuncia) => denuncia.fotografias, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
