import {
  IsString,
  IsOptional,
  IsBase64,
  IsIn,
  IsArray,
  ArrayMaxSize,
  IsDateString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CALZADO,
  CIRCUNSTANCIA,
  COLOR_CABELLO,
  COLOR_OJOS,
  COLOR_PIEL,
  COLOR_PRENDA,
  CONDICION_RELEVANTE,
  CONTEXTURA,
  ESTATURA_RANGO,
  PRENDA_INFERIOR,
  PRENDA_SUPERIOR,
  SENA_PARTICULAR,
  SEXO,
  type Calzado,
  type Circunstancia,
  type ColorCabello,
  type ColorOjos,
  type ColorPiel,
  type ColorPrenda,
  type CondicionRelevante,
  type Contextura,
  type EstaturaRango,
  type PrendaInferior,
  type PrendaSuperior,
  type SenaParticular,
  type Sexo,
} from '../domain/descripcion-fisica';

/**
 * Corrección de una denuncia mientras siga sin declararse bajo juramento.
 *
 * Mismos dominios cerrados y mismas prohibiciones que al crear: si la edición
 * admitiera un campo que la creación no acepta, la puerta cerrada en un sitio
 * quedaría abierta en el otro. En particular no acepta `description`, el relato
 * libre que se retiró del formulario.
 *
 * El documento de la persona buscada no se puede corregir: cambiarlo
 * redirigiría la denuncia hacia otra persona conservando su historia.
 */
export class UpdateDenunciaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre_persona_buscada?: string;

  @IsOptional()
  @IsDateString()
  fecha_nacimiento?: string;

  @IsOptional()
  @IsIn(SEXO)
  sexo?: Sexo;

  @IsOptional()
  @IsIn(ESTATURA_RANGO)
  estatura_rango?: EstaturaRango;

  @IsOptional()
  @IsIn(CONTEXTURA)
  contextura?: Contextura;

  @IsOptional()
  @IsIn(COLOR_PIEL)
  color_piel?: ColorPiel;

  @IsOptional()
  @IsIn(COLOR_CABELLO)
  color_cabello?: ColorCabello;

  @IsOptional()
  @IsIn(COLOR_OJOS)
  color_ojos?: ColorOjos;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SENA_PARTICULAR.length)
  @IsIn(SENA_PARTICULAR, { each: true })
  senas_particulares?: SenaParticular[];

  @IsOptional()
  @IsDateString()
  ultimo_avistamiento_en?: string;

  @IsOptional()
  @IsIn(PRENDA_SUPERIOR)
  prenda_superior?: PrendaSuperior;

  @IsOptional()
  @IsIn(COLOR_PRENDA)
  color_prenda_superior?: ColorPrenda;

  @IsOptional()
  @IsIn(PRENDA_INFERIOR)
  prenda_inferior?: PrendaInferior;

  @IsOptional()
  @IsIn(COLOR_PRENDA)
  color_prenda_inferior?: ColorPrenda;

  @IsOptional()
  @IsIn(CALZADO)
  calzado?: Calzado;

  @IsOptional()
  @IsIn(CIRCUNSTANCIA)
  circunstancia?: Circunstancia;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONDICION_RELEVANTE.length)
  @IsIn(CONDICION_RELEVANTE, { each: true })
  condicion_relevante?: CondicionRelevante[];

  @IsOptional()
  @IsBase64()
  fotografia_base64?: string;
}
