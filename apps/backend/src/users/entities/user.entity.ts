import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, Index, OneToMany, Unique, Check } from 'typeorm';
import { RefreshToken } from './refresh-token.entity';
import { EstadoCuenta } from '../domain/estado-cuenta';

@Entity('users')
/**
 * Un documento registrado siempre tiene hash.
 *
 * El código ya escribe las dos columnas juntas, pero de eso depende algo que no
 * puede quedar en manos de una convención: el cierre de una alerta reconoce a
 * la persona reportada comparando `ci_hash`. Una cuenta marcada como
 * verificada sin hash podría denunciar y jamás ser identificada como
 * denunciante, ni retirar una alerta sobre sí misma.
 */
@Check(
  'chk_users_documento_con_hash',
  `((documento_registrado = false) OR (ci_hash IS NOT NULL))`,
)
// Segunda línea tras el enum del dominio: una escritura directa no puede dejar
// la cuenta en un estado que el código no sabe interpretar. Expresión en la
// forma normalizada de Postgres para que `migration:generate` no la recree.
@Check(
  'chk_users_estado_cuenta',
  `((estado_cuenta)::text = ANY ((ARRAY['ACTIVA'::character varying, 'SUSPENDIDA'::character varying])::text[]))`,
)
/**
 * El nombre está entero o no está.
 *
 * Las partes son nulas en las cuentas creadas antes de que el formulario las
 * pidiera: de esas solo se conserva `full_name`, y reconstruir sus partes sería
 * inventar de qué parte viene cada palabra. Lo que no puede ocurrir es el estado
 * intermedio —nombre sin apellido, apellido sin nombre—, porque `full_name` se
 * compone de las partes y una parte perdida produciría un nombre distinto del
 * que la persona declaró.
 */
/**
 * El correo se guarda siempre en minúsculas y sin espacios alrededor.
 *
 * Junto con la unicidad de `email`, esto es lo que hace imposible que existan
 * dos cuentas para el mismo correo escrito en distinta caja. Si solo estuviera
 * normalizado en el DTO, una escritura directa —una migración, un arreglo a mano
 * en producción— podría crear esa segunda identidad, y en un sistema cuya
 * garantía es la atribución eso es un agujero, no una molestia.
 */
@Check('chk_users_correo_canonico', `((email)::text = lower(btrim((email)::text)))`)
@Check(
  'chk_users_nombre_completo_o_ausente',
  `(((primer_nombre IS NULL) AND (primer_apellido IS NULL) AND (segundo_apellido IS NULL)) OR ((primer_nombre IS NOT NULL) AND (primer_apellido IS NOT NULL) AND (segundo_apellido IS NOT NULL)))`,
)
@Index('idx_users_email', ['email'])
@Index('idx_users_ci_hash', ['ci_hash'])
@Index('idx_users_push_token', ['push_token'], { where: '"push_token" IS NOT NULL' })
@Unique(['ci_hash'])
@Unique(['email'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /**
   * Nombre completo de la cuenta, compuesto de las cuatro partes.
   *
   * Es un valor derivado, pero se almacena y no se calcula al vuelo porque es el
   * que viaja a la constancia probatoria y contra el que se compara la firma
   * escrita a mano; una columna real lo hace consultable y estable. Se escribe
   * siempre con `componerNombre`, nunca a mano.
   *
   * Conserva el nombre suelto de las cuentas anteriores al desglose, que no
   * tienen partes.
   */
  @Column({ type: 'varchar', length: 120 })
  full_name!: string;

  // Partes del nombre, en el orden del carnet. Nulas solo en las cuentas
  // anteriores al desglose; para una cuenta nueva las tres obligatorias siempre
  // están, y la restricción `chk_users_nombre_completo_o_ausente` lo sostiene.
  @Column({ type: 'varchar', length: 30, nullable: true })
  primer_nombre!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  segundo_nombre!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  primer_apellido!: string | null;

  @Column({ type: 'varchar', length: 30, nullable: true })
  segundo_apellido!: string | null;

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

  /**
   * Si la cuenta está suspendida.
   *
   * Es lo único del régimen de sanciones que se guarda en la cuenta, y es
   * derivable: queda SUSPENDIDA en la misma transacción del cierre que la
   * suspende, y hay una prueba de que coincide con lo que dicen los cierres. Se
   * guarda porque la consulta de destinatarios de cada alerta lo filtra.
   */
  @Column({ type: 'varchar', length: 20, default: EstadoCuenta.ACTIVA })
  estado_cuenta!: EstadoCuenta;

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
}
