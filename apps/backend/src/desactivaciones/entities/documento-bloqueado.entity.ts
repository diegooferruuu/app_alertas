import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from 'typeorm';

/**
 * Documento cuyo re-registro queda impedido (§3.4).
 *
 * Guarda el `ci_hash` de una cuenta suspendida. Existe para que una suspensión
 * no se pueda esquivar creando otra cuenta y volviendo a registrar el mismo
 * documento: la unicidad de `ci_hash` en `users` ya lo impediría mientras el
 * documento siga en la cuenta original, pero este registro es la política
 * explícita —«este documento está bloqueado»— y no un efecto colateral de que
 * la cuenta vieja aún exista.
 *
 * Guarda el hash, no el número. No se borra: levantar un bloqueo sería una
 * decisión deliberada, no un olvido.
 */
@Entity('documentos_bloqueados')
export class DocumentoBloqueado {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Única: un documento se bloquea una sola vez. */
  @Column({ type: 'varchar', length: 64, unique: true })
  ci_hash!: string;

  /** La cuenta que motivó el bloqueo, para poder auditarlo. */
  @Column({ type: 'uuid', nullable: true })
  usuario_id!: string | null;

  @Column({ type: 'varchar', length: 60 })
  motivo!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  bloqueado_en!: Date;
}
