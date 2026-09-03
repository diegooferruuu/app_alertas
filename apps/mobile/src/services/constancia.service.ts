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

export interface Constancia {
  denuncia_id: string;
  alcance: AlcanceConstancia;
  denuncia: {
    nombre_persona_buscada: string | null;
    description: string;
    created_at: string;
    estado: string;
  };
  firmantes: FirmanteDeLaConstancia[];
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
}

export const constanciaService = new ConstanciaService();
export default constanciaService;
