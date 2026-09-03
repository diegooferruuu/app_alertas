import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Versión del texto legal de la declaración jurada.
 *
 * El versionado existe por una razón concreta: si el texto cambia dentro de seis
 * meses, un caso de hoy tiene que poder demostrar **qué decía exactamente**
 * cuando la persona lo aceptó. Una constancia que citara el texto vigente hoy
 * en lugar del que se mostró entonces no probaría nada.
 *
 * Por eso cada declaración referencia una versión en lugar de copiar el texto:
 * copiarlo en cada registro multiplicaría el mismo contenido miles de veces y,
 * peor, permitiría que dos copias del mismo texto divergieran.
 *
 * Es una tabla de solo-inserción. Corregir una redacción significa publicar una
 * versión nueva, nunca editar una existente: editarla cambiaría lo que dice
 * haber aceptado gente que aceptó otra cosa.
 */
@Entity('versiones_texto_legal')
@Index('idx_versiones_texto_legal_vigente', ['vigente'], {
  unique: true,
  where: '"vigente" = true',
})
export class VersionTextoLegal {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Identificador legible de la versión, p. ej. «v1». */
  @Column({ type: 'varchar', length: 20, unique: true })
  version!: string;

  /** El texto exacto que se muestra a la persona antes de aceptar. */
  @Column({ type: 'text' })
  texto!: string;

  /**
   * SHA-256 del texto.
   *
   * Permite comprobar, años después, que el texto guardado es el mismo que se
   * mostró: la constancia incluye este hash y cualquiera puede recalcularlo
   * sobre el texto para verificar que nadie lo alteró.
   */
  @Column({ type: 'varchar', length: 64 })
  hash_texto!: string;

  /**
   * Si es la versión que se está mostrando ahora.
   *
   * Solo una puede serlo a la vez; lo garantiza un índice único parcial. Las
   * anteriores se conservan porque hay declaraciones que las referencian.
   */
  @Column({ type: 'boolean', default: false })
  vigente!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  creada_en!: Date;
}
