import type { ResultadoComparacion } from '../domain/comparacion-facial';

/**
 * Mensajes entre el comparador y su hilo de inferencia.
 *
 * Solo viajan píxeles de ida y un resultado de vuelta. Los descriptores
 * faciales se calculan y se descartan dentro del hilo: un descriptor identifica
 * a una persona igual que su fotografía, y así no cruza ni siquiera a la
 * memoria del proceso principal.
 */

/** Imagen ya decodificada: RGB, tres bytes por píxel, fila tras fila. */
export interface Pixeles {
  /** Se transfiere al hilo, no se copia: después de enviarlo queda vacío aquí. */
  datos: ArrayBuffer;
  ancho: number;
  alto: number;
}

export interface PeticionComparacion {
  id: number;
  documento: Pixeles;
  selfie: Pixeles;
}

export type RespuestaComparacion =
  | {
      id: number;
      resultado: ResultadoComparacion;
      /** Solo en la respuesta que tuvo que cargar los modelos: cuánto tardó. */
      cargaMs?: number;
    }
  | { id: number; error: string };
