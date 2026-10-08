import { IsUUID, Matches } from 'class-validator';
import { FIRMA_HEX } from '../domain/firma-dispositivo';

export class ProlongarAlertaDto {
  /** Versión del texto legal que se mostró al prolongar, no «la vigente». */
  @IsUUID()
  version_texto_legal_id!: string;

  /** La clave registrada del teléfono, y su firma sobre `mensajeDeProlongacion`. */
  @IsUUID()
  clave_dispositivo_id!: string;

  @Matches(FIRMA_HEX, { message: 'La firma del dispositivo debe ser Ed25519 en hexadecimal' })
  firma_dispositivo!: string;
}
