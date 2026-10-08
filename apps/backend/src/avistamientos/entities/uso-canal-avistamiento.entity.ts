import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
  Check,
} from 'typeorm';
import { Denuncia } from '../../denuncias/entities/denuncia.entity';

/** Por dónde se entregó el reporte: el botón «Llamar» o «Enviar mensaje». */
export type CanalAvistamiento = 'LLAMADA' | 'MENSAJE';

export const CANALES_AVISTAMIENTO: CanalAvistamiento[] = ['LLAMADA', 'MENSAJE'];

/**
 * Que alguien tocó «Llamar» o «Enviar mensaje» en un reporte de avistamiento.
 *
 * Es todo lo que el servidor llega a saber de un avistamiento (I2): ni quién,
 * ni dónde, ni cuándo se vio a la persona. Eso viaja del teléfono a la
 * autoridad sin pasar por aquí.
 *
 * Sirve para medir en la beta la **intención de reporte**. Cuenta toques, no
 * reportes entregados: lo que pasa después del toque ocurre fuera del sistema.
 *
 * No tiene `usuario_id` a propósito, y la hora queda truncada al minuto porque,
 * con pocos usuarios, una hora exacta se podría cruzar con otros registros.
 */
@Entity('usos_canal_avistamiento')
@Index('idx_usos_canal_denuncia', ['denuncia_id'])
@Check(
  'chk_usos_canal_canal',
  `((canal)::text = ANY ((ARRAY['LLAMADA'::character varying, 'MENSAJE'::character varying])::text[]))`,
)
// En la base y no solo en el valor por defecto: una escritura directa tampoco
// puede guardar segundos.
@Check('chk_usos_canal_al_minuto', `(creado_en = date_trunc('minute'::text, creado_en))`)
export class UsoCanalAvistamiento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid' })
  denuncia_id!: string;

  @Column({ type: 'varchar', length: 10 })
  canal!: CanalAvistamiento;

  @Column({ type: 'timestamptz', default: () => "date_trunc('minute', now())" })
  creado_en!: Date;

  /**
   * CASCADE: es una métrica, no una prueba. Si la denuncia desaparece con su
   * autor, contar toques sobre ella deja de tener sentido.
   */
  @ManyToOne(() => Denuncia, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
