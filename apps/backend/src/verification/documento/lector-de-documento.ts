/**
 * Lectura del texto impreso en un documento de identidad.
 *
 * Es un puerto por el mismo motivo que `ComparadorDeRostros`: es la parte cara y
 * externa, y la que más probabilidades tiene de cambiar. Tesseract es lo que hay
 * hoy; PaddleOCR, un servicio en la nube o un modelo entrenado con carnets
 * bolivianos son sustituciones plausibles, y ninguna debería obligar a tocar el
 * flujo de registro.
 *
 * **El lector extrae texto; no autentica ni interpreta.** Devuelve lo que leyó,
 * tal cual, con su ruido. Decidir si ese texto es consistente con lo declarado
 * es una regla del dominio y vive en el núcleo, igual que el umbral facial. Un
 * lector que devolviera «coincide: sí» estaría tomando una decisión que no le
 * toca.
 */
export abstract class LectorDeDocumento {
  /**
   * Texto crudo del anverso del documento.
   *
   * Recibe los bytes ya decodificados de base64. El resultado no se normaliza
   * aquí: quien compara sabe cómo tratar el ruido del OCR —tildes perdidas,
   * eñes convertidas en enes, caracteres sueltos— y normalizar dos veces con
   * criterios distintos produciría comparaciones que no significan nada.
   */
  abstract leer(imagen: Buffer): Promise<string>;
}

/**
 * Doble de pruebas: devuelve el texto que se le indique, sin cargar Tesseract.
 *
 * Arrancar un trabajador de OCR y reconocer una imagen cuesta unos 300 ms por
 * llamada. Las pruebas de integración del registro de documento no necesitan
 * ejercitar el reconocimiento —para eso está la prueba del lector real—, sino
 * qué hace el sistema ante cada texto posible.
 */
export class LectorDeDocumentoSimulado extends LectorDeDocumento {
  constructor(private texto = '') {
    super();
  }

  /** Cambia qué devolverá la próxima lectura. */
  devolver(texto: string): void {
    this.texto = texto;
  }

  async leer(): Promise<string> {
    return this.texto;
  }
}
