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

/**
 * Denuncia de desaparición.
 *
 * El sistema no llama víctima a la persona buscada: no toda desaparición supone
 * un delito, y nombrarla así prejuzgaría el caso. Tampoco hay categoría: se
 * atiende un único tipo de caso.
 */
export type DenunciaEstado = 'activo' | 'verificado' | 'resuelto' | 'descartado';

@Entity('denuncias')
@Index('idx_denuncias_created_at', ['created_at'])
export class Denuncia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denunciante_id!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre_persona_buscada!: string | null;

  @Column({ type: 'text' })
  description!: string;

  // Último lugar conocido
  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  /**
   * Punto geográfico derivado de latitude/longitude, con índice GiST.
   *
   * Es una columna GENERADA por Postgres: no se escribe desde el código y no
   * puede desincronizarse de las coordenadas. Existe porque `ST_DWithin` sobre
   * un cast por fila no puede usar índice y obliga a recorrer toda la tabla.
   */
  @Index('idx_denuncias_ubicacion', { spatial: true })
  @Column({
    type: 'geography',
    spatialFeatureType: 'Point',
    srid: 4326,
    generatedType: 'STORED',
    asExpression:
      'ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography',
    select: false,
    insert: false,
    update: false,
  })
  ubicacion!: string;

  // Fotografía opcional. Se traslada a tabla propia en H1.6: esta tabla es
  // sobre la que corre la consulta de proximidad y su tamaño la degrada.
  @Column({ type: 'text', nullable: true })
  photo_base64!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'activo' })
  status!: DenunciaEstado;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'denunciante_id' })
  denunciante!: User;
}
