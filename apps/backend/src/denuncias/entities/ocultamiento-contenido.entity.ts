import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Denuncia } from './denuncia.entity';

/**
 * El contenido de una alerta que dejó de mostrarse a terceros tras un reporte.
 *
 * Es la única intervención manual del sistema, y está acotada a propósito: no
 * borra la denuncia, no la cierra, no toca su declaración jurada ni sanciona a
 * nadie (I7). Solo deja de mostrar la fotografía y el relato libre a quien no la
 * presentó —en la app y en la ficha pública—. El nombre y las señas siguen,
 * porque sin ellos la alerta no sirve para buscar a nadie.
 *
 * Existe porque Google Play exige que el contenido que publican los usuarios se
 * pueda reportar y que haya forma de actuar sobre él. Quien opera el servidor
 * la registra con `deploy/ocultar-contenido.sh`; la app no tiene ningún rol que
 * pueda hacerlo.
 *
 * De **solo inserción**, con disparador: ocultar deja constancia de cuándo y
 * por qué, y esa constancia no se puede reescribir.
 */
@Entity('ocultamientos_contenido')
export class OcultamientoContenido {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  /** Una vez por denuncia: ocultar dos veces no cambia nada. */
  @Column({ type: 'uuid', unique: true })
  denuncia_id!: string;

  /** Por qué se ocultó, con las palabras de quien lo decidió. */
  @Column({ type: 'text' })
  motivo!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  creado_en!: Date;

  @ManyToOne(() => Denuncia, { onDelete: 'NO ACTION' })
  @JoinColumn({ name: 'denuncia_id' })
  denuncia!: Denuncia;
}
