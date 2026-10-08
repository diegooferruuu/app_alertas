import { IsIn } from 'class-validator';
import { CANALES_AVISTAMIENTO, CanalAvistamiento } from '../entities/uso-canal-avistamiento.entity';

/** Solo el canal. No hay campo para la zona, la hora ni nada del avistamiento. */
export class UsoCanalDto {
  @IsIn(CANALES_AVISTAMIENTO)
  canal!: CanalAvistamiento;
}
