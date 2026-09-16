import { ResultadoComparacion } from '../domain/comparacion-facial';

/**
 * Compara el rostro de una selfie con el impreso en un documento.
 *
 * Es una clase abstracta y no una interfaz porque Nest resuelve dependencias
 * por token en tiempo de ejecución, y una interfaz de TypeScript no existe
 * entonces. Es el mismo patrón que `PasarelaPush`.
 *
 * Existir como puerto tiene un motivo concreto: las pruebas de integración no
 * pueden cargar un modelo de 12 MB ni ejecutar inferencia por cada caso, pero sí
 * necesitan ejercer qué hace el registro de documento ante cada resultado
 * posible. El doble de pruebas devuelve el resultado que haga falta.
 */
export abstract class ComparadorDeRostros {
  /**
   * Ambas imágenes llegan como bytes ya decodificados de base64.
   *
   * Ninguna de las dos se almacena, ni tampoco los descriptores que se calculan
   * a partir de ellas: un descriptor facial identifica a una persona igual que
   * la foto, así que guardarlo sería guardar un dato biométrico. Se comparan y
   * se descartan dentro de esta llamada.
   */
  abstract comparar(
    documento: Buffer,
    selfie: Buffer,
  ): Promise<ResultadoComparacion>;
}

/**
 * Doble de pruebas: devuelve lo que se le diga, sin cargar ningún modelo.
 *
 * Por defecto acepta, porque la mayoría de las pruebas de otros asuntos
 * necesitan que el registro de documento llegue hasta el final.
 */
export class ComparadorDeRostrosSimulado extends ComparadorDeRostros {
  constructor(
    private resultado: ResultadoComparacion = {
      estado: 'comparado',
      distancia: 0.2,
    },
  ) {
    super();
  }

  /** Cambia qué devolverá la próxima comparación. */
  devolver(resultado: ResultadoComparacion): void {
    this.resultado = resultado;
  }

  async comparar(): Promise<ResultadoComparacion> {
    return this.resultado;
  }
}
