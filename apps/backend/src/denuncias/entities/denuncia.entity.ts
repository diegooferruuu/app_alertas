import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
  Check,
  OneToMany,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { FotografiaDenuncia } from './fotografia-denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../domain/estados';

/**
 * Denuncia de desaparición.
 *
 * El sistema no llama víctima a la persona buscada: no toda desaparición supone
 * un delito, y nombrarla así prejuzgaría el caso. Tampoco hay categoría: se
 * atiende un único tipo de caso.
 */
@Entity('denuncias')
@Index('idx_denuncias_created_at', ['created_at'])
@Index('idx_denuncias_ci_persona_buscada', ['ci_hash_persona_buscada'])
// Los valores válidos se controlan en el dominio; estas restricciones son la
// segunda línea, para que una escritura directa a la base no pueda dejar la
// máquina de estados en un valor que el código no sabe interpretar.
// Las expresiones están escritas tal como Postgres las normaliza, para que
// `migration:generate` no proponga recrearlas en cada ejecución.
@Check(
  'chk_denuncias_nivel_confianza',
  `((nivel_confianza)::text = ANY ((ARRAY['REGISTRADA'::character varying, 'PROVISIONAL'::character varying, 'CORROBORADA'::character varying])::text[]))`,
)
@Check(
  'chk_denuncias_estado',
  `((estado)::text = ANY ((ARRAY['ACTIVA'::character varying, 'CADUCADA'::character varying, 'INVALIDADA'::character varying, 'CERRADA'::character varying])::text[]))`,
)
// Una denuncia difundible tiene siempre radio y caducidad; una REGISTRADA no
// tiene ninguno de los dos. Impide el intermedio incoherente de una alerta
// emitida sin plazo de vencimiento.
@Check(
  'chk_denuncias_difusion_coherente',
  `(((((nivel_confianza)::text = 'REGISTRADA'::text) AND (radio_actual_m IS NULL) AND (expira_en IS NULL)) OR (((nivel_confianza)::text <> 'REGISTRADA'::text) AND (radio_actual_m IS NOT NULL) AND (expira_en IS NOT NULL))))`,
)
export class Denuncia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denunciante_id!: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  nombre_persona_buscada!: string | null;

  /**
   * SHA-256 del documento de la persona buscada. Obligatorio.
   *
   * Es el campo que habilita el interruptor de desactivación: sin él, la persona
   * reportada no tendría forma de demostrar que una denuncia la identifica. El
   * número nunca se almacena en claro, y este hash no viaja en ninguna respuesta.
   */
  @Column({ type: 'varchar', length: 64, select: false })
  ci_hash_persona_buscada!: string;

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

  /**
   * Fotografías de la persona buscada, en tabla aparte.
   *
   * Nunca se cargan solas: quien las necesite —solo la vista de detalle— las
   * pide explícitamente. Es lo que mantiene ligeras las filas sobre las que
   * corre la consulta de proximidad.
   */
  @OneToMany(() => FotografiaDenuncia, (foto) => foto.denuncia)
  fotografias!: FotografiaDenuncia[];

  /**
   * Cuánto respaldo tiene el caso. Nace REGISTRADA: existe pero no se difunde.
   * Es el invariante I1 expresado en datos — crear y emitir son operaciones
   * distintas.
   */
  @Column({
    type: 'varchar',
    length: 20,
    default: NivelConfianza.REGISTRADA,
  })
  nivel_confianza!: NivelConfianza;

  @Column({ type: 'varchar', length: 20, default: EstadoDenuncia.ACTIVA })
  estado!: EstadoDenuncia;

  /** Alcance de la difusión de este caso. Nulo mientras no se difunda. */
  @Column({ type: 'integer', nullable: true })
  radio_actual_m!: number | null;

  /** Cuándo caduca la alerta. Nulo mientras el nivel sea REGISTRADA. */
  @Column({ type: 'timestamptz', nullable: true })
  expira_en!: Date | null;

  /** Número de caso de la FELCC. Una de las dos vías de corroboración. */
  @Column({ type: 'varchar', length: 60, nullable: true })
  numero_caso_felcc!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'denunciante_id' })
  denunciante!: User;
}
