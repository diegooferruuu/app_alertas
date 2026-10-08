import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { TipoCierre } from '../entities/cierre.entity';

export class CerrarDenunciaDto {
  @IsEnum(TipoCierre, {
    message: 'El tipo de cierre debe ser SIN_SANCION («Estoy bien») o CON_SANCION («Esta denuncia es falsa»)',
  })
  tipo!: TipoCierre;

  /**
   * Solo con «Estoy bien»: si quien denunció podrá volver a hacerlo. Es
   * obligatorio en ese caso —la app pregunta sin opción marcada—, y se ignora
   * con «Es falsa», que siempre bloquea.
   */
  @IsOptional()
  @IsBoolean()
  bloquear_nueva_denuncia?: boolean;
}
