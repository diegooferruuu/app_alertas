import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Check,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Denuncia } from '../../denuncias/entities/denuncia.entity';

/**
 * Por qué alguien reporta el contenido de una alerta.
 *
 * No hay «la denuncia es falsa»: eso solo puede declararlo la persona
 * reportada, con su falta (I9). Un vecino no sabe si una desaparición es real;
 * sí puede ver que una foto es obscena o que la alerta es una broma.
 */
export const MOTIVOS_DE_REPORTE = [
  'imagen_inapropiada',
  'contenido_ofensivo',
  'no_es_una_desaparicion',
  'otro',
] as const;

export type MotivoDeReporte = (typeof MOTIVOS_DE_REPORTE)[number];

/**
 * Un reporte del contenido de una alerta, hecho por alguien que no la presentó.
 *
 * Reportar no oculta ni detiene nada por sí solo: avisa a quien opera el
 * sistema, que decide si ocultar la foto (`OcultamientoContenido`). Si contar
 * reportes bastara para ocultarla, tres personas de acuerdo podrían borrar de
 * la vista la cara de alguien que de verdad desapareció.
 *
 * De **solo inserción**, con disparador: es el rastro de lo que se pidió y
 * cuándo. Quién reportó no se le muestra a nadie, tampoco a quien denunció.
 */
@Entity('reportes_contenido')
// Una persona reporta una alerta una vez: insistir no suma.
@Unique('uq_reportes_contenido_denuncia_usuario', ['denuncia_id', 'usuario_id'])
@Check(
  'chk_reportes_contenido_motivo',
  `((motivo)::text = ANY ((ARRAY['imagen_inapropiada'::character varying, 'contenido_ofensivo'::character varying, 'no_es_una_desaparicion'::character varying, 'otro'::character varying])::text[]))`
)
export class ReporteContenido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denuncia_id!: string;

  /** Quien reporta. */
  @Column({ type: 'uuid' })
  usuario_id!: string;

  @Column({ type: 'varchar', length: 30 })
  motivo!: MotivoDeReporte;

  /** Lo que la persona quiso agregar, si quiso. */
  @Column({ type: 'varchar', length: 500, nullable: true })
  detalle!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creado_en!: Date;

  @ManyToOne(() => Denuncia, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;

  @ManyToOne(() => User, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: User;
}
