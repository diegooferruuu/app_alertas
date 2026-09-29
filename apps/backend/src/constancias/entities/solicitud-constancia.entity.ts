import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/** Qué se le entregó a quien solicitó. */
export type AlcanceConstancia = 'completa' | 'propia_declaracion';

/**
 * Registro de que alguien pidió una constancia (§6.1).
 *
 * La entrega de la identidad del denunciante es un acto deliberado, y por eso
 * queda auditado: quién pidió qué y cuándo. No es un control de acceso —la
 * autorización se decide antes— sino el rastro de que esa identidad se entregó.
 *
 * Sin unicidad a propósito: la constancia está disponible de forma indefinida y
 * puede pedirse las veces que haga falta. Cada petición se registra por separado,
 * porque lo que interesa auditar es cada entrega, no que exista una.
 */
@Entity('solicitudes_constancia')
@Index('idx_solicitudes_constancia_denuncia', ['denuncia_id'])
@Index('idx_solicitudes_constancia_solicitante', ['solicitante_id'])
export class SolicitudConstancia {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denuncia_id!: string;

  @Column({ type: 'uuid' })
  solicitante_id!: string;

  /**
   * Documento de quien solicitó, en hash.
   *
   * Se guarda además del identificador de cuenta porque es lo que sobrevive a
   * que alguien cambie de cuenta: el rastro sigue apuntando a la misma persona.
   */
  @Column({ type: 'varchar', length: 64 })
  ci_hash_solicitante!: string;

  /**
   * `completa` para la persona reportada —tiene derecho a saber quiénes firmaron
   * contra ella—; `propia_declaracion` para quien firmó, que solo accede a lo
   * que él mismo declaró.
   */
  @Column({ type: 'varchar', length: 30 })
  alcance!: AlcanceConstancia;

  @CreateDateColumn({ type: 'timestamptz' })
  solicitada_en!: Date;
}
