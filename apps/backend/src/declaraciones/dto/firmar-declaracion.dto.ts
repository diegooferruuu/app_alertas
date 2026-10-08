import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { VINCULOS_VALIDOS } from '../domain/vinculos';
import { FIRMA_HEX } from '../domain/firma-dispositivo';

export class FirmarDeclaracionDto {
  /** Versión del texto legal que se mostró, no «la vigente». */
  @IsUUID()
  version_texto_legal_id!: string;

  /**
   * Vínculo con la persona buscada, de la lista cerrada.
   *
   * Sin opción de texto libre: una declaración vaga no es falsable, y un campo
   * abierto podría contener datos de un tercero, que el invariante I3 prohíbe.
   */
  @IsString()
  @IsIn(VINCULOS_VALIDOS)
  vinculo_declarado!: string;

  /**
   * El nombre completo escrito a mano por la persona.
   *
   * Se guarda literal como prueba; la comparación con el nombre registrado la
   * hace el servidor, no el cliente.
   */
  @IsString()
  @MaxLength(200)
  nombre_escrito!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  device_id?: string;

  /**
   * La clave registrada del teléfono que firma, y su firma Ed25519 sobre lo
   * declarado. Obligatorias: toda declaración nueva lleva la firma del teléfono.
   */
  @IsUUID()
  clave_dispositivo_id!: string;

  @Matches(FIRMA_HEX, { message: 'La firma del dispositivo debe ser Ed25519 en hexadecimal' })
  firma_dispositivo!: string;
}
