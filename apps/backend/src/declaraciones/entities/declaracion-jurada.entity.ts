import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { VinculoDeclarado } from '../domain/vinculos';
import { VersionTextoLegal } from './version-texto-legal.entity';
import { Denuncia } from '../../denuncias/entities/denuncia.entity';

/** Distingue la declaración que difunde el caso de las que lo corroboran. */
export type TipoDeclaracion = 'original' | 'corroboracion';

/**
 * Paquete probatorio de una declaración jurada.
 *
 * Es una tabla **append-only**: no existe ninguna ruta de código que actualice
 * ni elimine filas, ni siquiera para un moderador (invariante I4). La razón es
 * directa — si una declaración pudiera editarse, no probaría nada: cualquiera
 * podría cambiar después lo que dijo haber declarado.
 *
 * Cada registro encadena su hash con el del anterior. Alterar o suprimir uno
 * rompe la cadena a partir de ahí, y eso es comprobable por un tercero sin
 * necesidad de confiar en el sistema.
 */
@Entity('declaraciones_juradas')
@Index('idx_declaraciones_denuncia', ['denuncia_id'])
@Index('idx_declaraciones_usuario', ['usuario_id'])
export class DeclaracionJurada {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denuncia_id!: string;

  @Column({ type: 'uuid' })
  usuario_id!: string;

  /** Documento de quien declara, en hash. Nunca en claro. */
  @Column({ type: 'varchar', length: 64 })
  ci_hash_declarante!: string;

  @Column({ type: 'varchar', length: 30 })
  vinculo_declarado!: VinculoDeclarado;

  /**
   * Original difunde el caso; corroboración lo respalda.
   *
   * Un campo aquí evita una tabla aparte para las corroboraciones: son el mismo
   * acto de firma, con el mismo paquete probatorio. El contador de
   * corroboraciones se deriva de estas filas y no se guarda duplicado.
   */
  @Column({ type: 'varchar', length: 20, default: 'original' })
  tipo!: TipoDeclaracion;

  /** Referencia a la versión mostrada, no una copia del texto. */
  @Column({ type: 'uuid' })
  version_texto_legal_id!: string;

  /** Hash del texto exacto que se mostró, para detectar alteraciones. */
  @Column({ type: 'varchar', length: 64 })
  hash_texto_legal!: string;

  /**
   * La frase que la persona escribió, literal.
   *
   * Se guarda tal cual la tecleó, sin normalizar: la comparación es tolerante,
   * pero lo que se conserva como prueba es exactamente lo que escribió.
   */
  @Column({ type: 'text' })
  texto_firmado!: string;

  /**
   * Hash del contenido de la denuncia en el instante de declarar.
   *
   * Es lo que sella el contenido: si la denuncia cambiara después, este hash ya
   * no correspondería y la alteración quedaría en evidencia.
   */
  @Column({ type: 'varchar', length: 64 })
  hash_contenido_denuncia!: string;

  /** Identificador del dispositivo desde el que se firmó. */
  @Column({ type: 'varchar', length: 120, nullable: true })
  device_id!: string | null;

  /** Firma Ed25519 del dispositivo. Se implementa en la fase 6. */
  @Column({ type: 'text', nullable: true })
  firma_criptografica!: string | null;

  @Column({ type: 'uuid', nullable: true })
  clave_publica_id!: string | null;

  /**
   * Hash del registro anterior de la cadena.
   *
   * Nulo solo en el primer registro. Encadenar hacia atrás es lo que hace que
   * suprimir una declaración intermedia sea detectable.
   */
  @Column({ type: 'varchar', length: 64, nullable: true })
  hash_anterior!: string | null;

  /** SHA-256 de la concatenación de los campos anteriores. */
  @Column({ type: 'varchar', length: 64, unique: true })
  hash_registro!: string;

  /** Generado en el servidor, nunca aceptado del cliente. */
  @CreateDateColumn({ type: 'timestamptz' })
  firmada_en!: Date;

  @ManyToOne(() => VersionTextoLegal)
  @JoinColumn({ name: 'version_texto_legal_id' })
  version_texto_legal!: VersionTextoLegal;

  /**
   * Sin cascada al borrar, a propósito.
   *
   * Con ON DELETE CASCADE, eliminar la denuncia arrastraría su paquete
   * probatorio y burlaría el invariante I4 por la puerta de atrás. Aquí el
   * borrado debe fallar.
   */
  @ManyToOne(() => Denuncia, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
