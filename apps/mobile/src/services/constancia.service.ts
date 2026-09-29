import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { apiClient } from './api';

export type AlcanceConstancia = 'completa' | 'propia_declaracion';

export interface FirmanteDeLaConstancia {
  nombre: string;
  /** El documento en hash: el número nunca se almacenó en claro. */
  ci_hash: string;
  vinculo_declarado: string;
  tipo: 'original' | 'corroboracion';
  /** Literal, tal como lo tecleó al firmar. */
  texto_firmado: string;
  firmada_en: string;
  con_firma_criptografica: boolean;
}

/** Los campos sellados, tal como entran en el hash. Se publican para verificar. */
export interface DeclaracionVerificable {
  denuncia_id: string;
  usuario_id: string;
  ci_hash_declarante: string;
  vinculo_declarado: string;
  tipo: 'original' | 'corroboracion';
  version_texto_legal_id: string;
  hash_texto_legal: string;
  texto_firmado: string;
  hash_contenido_denuncia: string;
  firmada_en: string;
  device_id: string | null;
  hash_anterior: string | null;
  hash_registro: string;
  firma_criptografica: string | null;
  clave_publica: string | null;
}

export interface Constancia {
  formato: string;
  denuncia_id: string;
  alcance: AlcanceConstancia;
  denuncia: {
    id: string;
    nombre_persona_buscada: string | null;
    ci_hash_persona_buscada: string;
    description: string;
    /** Cadena ya redondeada a 7 decimales: es lo que entró en el hash. */
    latitude: string;
    longitude: string;
    estado: string;
    created_at: string;
  };
  firmantes: FirmanteDeLaConstancia[];
  declaraciones: DeclaracionVerificable[];
  textos_legales: Array<{
    id: string;
    version: string;
    texto: string;
    hash_texto: string;
  }>;
  verificacion: {
    algoritmo: string;
    separador: string;
    orden_campos_registro: string[];
    orden_campos_contenido: string[];
    procedimiento: string[];
    limites: string[];
  };
  emitida_en: string;
}

class ConstanciaService {
  /**
   * Solicita la constancia de una denuncia.
   *
   * Es POST y no GET porque no es una lectura: cada entrega de identidad queda
   * registrada en el servidor. No lleva justificación, y es deliberado — no hay
   * ante quién justificarse.
   */
  async solicitar(denunciaId: string): Promise<Constancia> {
    const response = await apiClient.post<Constancia>(
      `/constancias/denuncias/${denunciaId}`,
    );
    return response.data;
  }

  /**
   * Escribe la constancia como archivo y abre el diálogo para compartirla.
   *
   * El artefacto que se entrega es el JSON, no una captura ni un resumen: es lo
   * único que un tercero puede verificar recalculando los hashes. Se conserva
   * con sangría para que también se pueda leer a simple vista.
   */
  async exportar(constancia: Constancia): Promise<void> {
    const nombre = `constancia-${constancia.denuncia_id.slice(0, 8)}.json`;
    const archivo = new File(Paths.cache, nombre);

    if (archivo.exists) archivo.delete();
    archivo.create();
    archivo.write(JSON.stringify(constancia, null, 2));

    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Este dispositivo no permite compartir archivos.');
    }
    await Sharing.shareAsync(archivo.uri, {
      mimeType: 'application/json',
      dialogTitle: 'Constancia de la denuncia',
    });
  }
}

export const constanciaService = new ConstanciaService();
export default constanciaService;
