/**
 * Lo que firma el teléfono al declarar.
 *
 * Tiene que ser **idéntico** a `mensajeAFirmar` del servidor
 * (`apps/backend/src/declaraciones/domain/firma-dispositivo.ts`): si el teléfono
 * armara el mensaje distinto, toda firma se rechazaría. Las pruebas de los dos
 * lados usan el mismo vector para impedirlo.
 *
 * No incluye `hash_registro`: ese hash lo calcula el servidor al sellar y el
 * teléfono no puede conocerlo antes. Firma lo que la persona declara.
 */
export const ENCABEZADO_MENSAJE_FIRMA = 'declaracion-jurada/v1';

export interface DatosFirmados {
  denuncia_id: string;
  /** Lo entrega el servidor: `GET /declaraciones/denuncias/:id/contenido`. */
  hash_contenido_denuncia: string;
  /** El `hash_texto` del texto legal que se leyó. */
  hash_texto_legal: string;
  vinculo_declarado: string;
  /** El nombre tal como se escribió, sin normalizar: va igual a la petición. */
  texto_firmado: string;
}

/**
 * Una línea por campo, con el encabezado que versiona el formato. El nombre va
 * al final porque es el único texto libre: ni un salto de línea dentro de él
 * podría correr los campos anteriores.
 */
export const mensajeAFirmar = (d: DatosFirmados): string =>
  [
    ENCABEZADO_MENSAJE_FIRMA,
    d.denuncia_id,
    d.hash_contenido_denuncia,
    d.hash_texto_legal,
    d.vinculo_declarado,
    d.texto_firmado,
  ].join('\n');

/**
 * Lo que firma el teléfono al prolongar una alerta: que la persona sigue sin
 * aparecer. Idéntico a `mensajeDeProlongacion` del servidor.
 *
 * El número de prolongación va dentro: sin él, la firma de la primera serviría
 * también para las siguientes.
 */
export const ENCABEZADO_PROLONGACION = 'prolongacion-alerta/v1';

export interface DatosProlongacion {
  denuncia_id: string;
  /** La que se pide: la primera es 1. */
  numero: number;
  /** El `hash_texto` del texto legal vigente. */
  hash_texto_legal: string;
}

export const mensajeDeProlongacion = (d: DatosProlongacion): string =>
  [ENCABEZADO_PROLONGACION, d.denuncia_id, String(d.numero), d.hash_texto_legal].join('\n');
