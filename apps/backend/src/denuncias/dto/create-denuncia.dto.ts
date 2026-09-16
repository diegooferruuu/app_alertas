import {
  IsString,
  IsNumber,
  IsOptional,
  IsBase64,
  IsIn,
  IsArray,
  ArrayMaxSize,
  IsDateString,
  Matches,
  Min,
  Max,
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
 * Campos de una denuncia de desaparición.
 *
 * **No existe ningún campo de texto libre aquí salvo el nombre de la persona
 * buscada** (P1), que es el único sujeto nombrable del sistema. Todo lo demás es
 * de dominio cerrado. No hay campo alguno referido a un tercero —presunto
 * responsable, acompañante, vehículo, placa, apodo, dirección— (P3), ni de
 * recompensa ni de contacto del denunciante (P4), ni relato de los hechos (P5).
 *
 * `whitelist` y `forbidNonWhitelisted` están activos en el servidor, así que un
 * campo que no figure aquí se rechaza con 400 en vez de ignorarse en silencio.
 * Eso es lo que convierte estas ausencias en una garantía y no en una intención.
 */
export class CreateDenunciaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre_persona_buscada!: string;

  /**
   * Número de documento de la persona buscada. Obligatorio, sin excepción.
   *
   * Solo se guarda su hash: es lo que permite que esa persona desactive la
   * alerta si la denuncia es falsa. Sin este dato la denuncia sería
   * irreversible para quien resulta afectado, así que no hay vía alternativa.
   * El número en claro no se almacena, ni se registra en logs, ni vuelve en
   * ninguna respuesta de la API (P6).
   */
  @IsString()
  @Matches(/^\d{5,12}$/, {
    message: 'El documento de la persona buscada debe tener entre 5 y 12 dígitos',
  })
  ci_persona_buscada!: string;

  /** De aquí se deriva la edad; no se pide la edad por separado. */
  @IsDateString()
  fecha_nacimiento!: string;

  @IsIn(SEXO)
  sexo!: Sexo;

  @IsIn(ESTATURA_RANGO)
  estatura_rango!: EstaturaRango;

  @IsIn(CONTEXTURA)
  contextura!: Contextura;

  @IsIn(COLOR_PIEL)
  color_piel!: ColorPiel;

  @IsIn(COLOR_CABELLO)
  color_cabello!: ColorCabello;

  @IsIn(COLOR_OJOS)
  color_ojos!: ColorOjos;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(SENA_PARTICULAR.length)
  @IsIn(SENA_PARTICULAR, { each: true })
  senas_particulares?: SenaParticular[];

  /** No puede ser futura; se comprueba en el servicio contra su reloj. */
  @IsDateString()
  ultimo_avistamiento_en!: string;

  @IsIn(PRENDA_SUPERIOR)
  prenda_superior!: PrendaSuperior;

  @IsIn(COLOR_PRENDA)
  color_prenda_superior!: ColorPrenda;

  @IsIn(PRENDA_INFERIOR)
  prenda_inferior!: PrendaInferior;

  @IsIn(COLOR_PRENDA)
  color_prenda_inferior!: ColorPrenda;

  @IsOptional()
  @IsIn(CALZADO)
  calzado?: Calzado;

  @IsIn(CIRCUNSTANCIA)
  circunstancia!: Circunstancia;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(CONDICION_RELEVANTE.length)
  @IsIn(CONDICION_RELEVANTE, { each: true })
  condicion_relevante?: CondicionRelevante[];

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  /**
   * Rostro visible. Obligatoria, salvo que la persona buscada sea menor de edad.
   *
   * Opcional **aquí** y exigida en el servicio a propósito: la condición depende
   * de otro campo del mismo cuerpo —`fecha_nacimiento`— y esa es una regla del
   * dominio, no una comprobación de forma. Dejarla como `@IsBase64()` a secas
   * haría imposible el caso del menor; expresarla con un validador condicional
   * escondería en el DTO una decisión que tiene que poder leerse y probarse
   * sola. Ver `domain/minoria-edad.ts`.
   */
  @IsOptional()
  @IsBase64()
  fotografia_base64?: string;
}
