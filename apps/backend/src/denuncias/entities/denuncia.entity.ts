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
import {
  CALZADO,
  CIRCUNSTANCIA,
  COLOR_CABELLO,
  COLOR_OJOS,
  COLOR_PIEL,
  COLOR_PRENDA,
  CONDICION_RELEVANTE,
  CONTEXTURA,
  ESTATURA_RANGO,
  PRENDA_INFERIOR,
  PRENDA_SUPERIOR,
  SENA_PARTICULAR,
  SEXO,
  comoRestriccion,
  type Calzado,
  type Circunstancia,
  type ColorCabello,
  type ColorOjos,
  type ColorPiel,
  type ColorPrenda,
  type CondicionRelevante,
  type Contextura,
  type EstaturaRango,
  type PrendaInferior,
  type PrendaSuperior,
  type SenaParticular,
  type Sexo,
} from '../domain/descripcion-fisica';

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
// Una sola denuncia abierta por denunciante y persona. Sin esto, dos denuncias
// simultáneas sobre la misma persona, cerradas ambas como falsas, suspenderían
// una cuenta por la palabra de una sola persona. Vive en la base y no solo en
// el código para que dos peticiones a la vez no lo esquiven. «Abierta» incluye
// CADUCADA, porque una caducada todavía puede revivir con el caso de la FELCC.
@Index('uq_denuncias_abierta_por_persona', ['denunciante_id', 'ci_hash_persona_buscada'], {
  unique: true,
  where: `"estado" IN ('ACTIVA', 'CADUCADA')`,
})
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
// Cada campo descriptivo, contra su dominio. La especificación lo pide explícito
// (§7): validar solo en el servidor dejaría el dominio a merced de una escritura
// directa, y estos valores entran en el sellado de la declaración jurada.
@Check('chk_denuncias_sexo', comoRestriccion('sexo', SEXO))
@Check('chk_denuncias_estatura_rango', comoRestriccion('estatura_rango', ESTATURA_RANGO))
@Check('chk_denuncias_contextura', comoRestriccion('contextura', CONTEXTURA))
@Check('chk_denuncias_color_piel', comoRestriccion('color_piel', COLOR_PIEL))
@Check('chk_denuncias_color_cabello', comoRestriccion('color_cabello', COLOR_CABELLO))
@Check('chk_denuncias_color_ojos', comoRestriccion('color_ojos', COLOR_OJOS))
@Check('chk_denuncias_prenda_superior', comoRestriccion('prenda_superior', PRENDA_SUPERIOR))
@Check('chk_denuncias_prenda_inferior', comoRestriccion('prenda_inferior', PRENDA_INFERIOR))
@Check(
  'chk_denuncias_color_prenda_superior',
  comoRestriccion('color_prenda_superior', COLOR_PRENDA),
)
@Check(
  'chk_denuncias_color_prenda_inferior',
  comoRestriccion('color_prenda_inferior', COLOR_PRENDA),
)
@Check('chk_denuncias_calzado', comoRestriccion('calzado', CALZADO))
@Check('chk_denuncias_circunstancia', comoRestriccion('circunstancia', CIRCUNSTANCIA))
// Los campos de valor múltiple se comprueban por contención: todo elemento debe
// pertenecer al dominio.
@Check(
  'chk_denuncias_senas_particulares',
  `((senas_particulares IS NULL) OR (senas_particulares <@ (ARRAY[${SENA_PARTICULAR.map(
    (v) => `'${v}'::character varying`,
  ).join(', ')}])::character varying[]))`,
)
@Check(
  'chk_denuncias_condicion_relevante',
  `((condicion_relevante IS NULL) OR (condicion_relevante <@ (ARRAY[${CONDICION_RELEVANTE.map(
    (v) => `'${v}'::character varying`,
  ).join(', ')}])::character varying[]))`,
)
/**
 * Nadie nació después de haber sido visto por última vez (§7).
 *
 * La otra validación temporal de la especificación —que el avistamiento no sea
 * futuro— se queda en el DTO: `now()` no es inmutable y Postgres no la admite
 * dentro de una restricción CHECK.
 */
@Check(
  'chk_denuncias_nacimiento_antes_de_avistamiento',
  `((fecha_nacimiento IS NULL) OR (ultimo_avistamiento_en IS NULL) OR (fecha_nacimiento <= (ultimo_avistamiento_en)::date))`,
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
   * Es el campo que habilita el cierre por la persona reportada: sin él, no
   * tendría forma de demostrar que una denuncia la identifica. El
   * número nunca se almacena en claro, y este hash no viaja en ninguna respuesta.
   */
  @Column({ type: 'varchar', length: 64, select: false })
  ci_hash_persona_buscada!: string;

  /**
   * Relato libre de los hechos. **Retirado del formulario**; no se acepta en
   * denuncias nuevas.
   *
   * Era el único campo de texto libre del sistema y por tanto la única puerta
   * por la que podían entrar una acusación, el nombre de un tercero o un dato de
   * contacto. Que su etiqueta sugiriera qué escribir no bastaba: un campo
   * abierto admite cualquier cosa, y cerrar las interpretaciones es lo que
   * elimina la posibilidad.
   *
   * La columna sobrevive porque su contenido está sellado en el hash de las
   * denuncias ya firmadas: borrarla volvería inverificables constancias ya
   * emitidas. Las denuncias nuevas la dejan nula y sellan con la fórmula 2.
   */
  @Column({ type: 'text', nullable: true })
  description!: string | null;

  /**
   * Qué fórmula se usó para sellar el contenido de esta denuncia.
   *
   * La 1 sella cinco campos e incluye `description`; la 2 sella los campos
   * descriptivos cerrados y la excluye. Vive en la denuncia y no en cada
   * declaración porque describe la forma del contenido declarado: si dependiera
   * de la declaración, una corroboración firmada después de la migración sellaría
   * distinto que la original de la misma denuncia, y la constancia dejaría de
   * cuadrar consigo misma.
   */
  @Column({ type: 'integer', default: 1 })
  version_formula_contenido!: number;

  // ---------------------------------------------------------------------------
  // Datos de la persona buscada (§3). Todos de dominio cerrado salvo el nombre,
  // que es el único sujeto nombrable del sistema.
  //
  // Nulos para las denuncias anteriores a este formulario: no se van a inventar.
  // En las nuevas el DTO los exige, que es donde la obligatoriedad puede
  // comprobarse sin romper lo ya registrado.
  // ---------------------------------------------------------------------------

  /** De aquí se deriva la edad y la condición de minoría de edad. */
  @Column({ type: 'date', nullable: true })
  fecha_nacimiento!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sexo!: Sexo | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  estatura_rango!: EstaturaRango | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  contextura!: Contextura | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  color_piel!: ColorPiel | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  color_cabello!: ColorCabello | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  color_ojos!: ColorOjos | null;

  /** Opcional. Se guarda ordenado y sin repetidos; de eso depende el sellado. */
  @Column({ type: 'varchar', length: 15, array: true, nullable: true })
  senas_particulares!: SenaParticular[] | null;

  // ---------------------------------------------------------------------------
  // Datos del hecho (§4).
  // ---------------------------------------------------------------------------

  @Column({ type: 'timestamptz', nullable: true })
  ultimo_avistamiento_en!: Date | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  prenda_superior!: PrendaSuperior | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  color_prenda_superior!: ColorPrenda | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  prenda_inferior!: PrendaInferior | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  color_prenda_inferior!: ColorPrenda | null;

  @Column({ type: 'varchar', length: 15, nullable: true })
  calzado!: Calzado | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  circunstancia!: Circunstancia | null;

  @Column({ type: 'varchar', length: 30, array: true, nullable: true })
  condicion_relevante!: CondicionRelevante[] | null;

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
