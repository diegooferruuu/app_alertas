import { apiClient } from './api';

export interface Denuncia {
  id: string;
  denunciante_id: string;
  nombre_persona_buscada: string | null;
  description: string;
  latitude: number;
  longitude: number;
  photo_base64: string | null;
  status: 'activo' | 'verificado' | 'resuelto' | 'descartado';
  created_at: string;
  distance_meters?: number;
}

export interface CreateDenunciaPayload {
  nombre_persona_buscada: string;
  description: string;
  latitude: number;
  longitude: number;
  photo_base64?: string;
}

export interface UpdateDenunciaPayload {
  nombre_persona_buscada?: string;
  description?: string;
  photo_base64?: string;
}

class DenunciaService {
  async create(payload: CreateDenunciaPayload): Promise<Denuncia> {
    const response = await apiClient.post<Denuncia>('/denuncias', payload);
    return response.data;
  }

  async getNearby(lat: number, lng: number, radius = 5000): Promise<Denuncia[]> {
    const response = await apiClient.get<Denuncia[]>('/denuncias/cercanas', {
      params: { lat, lng, radius },
    });
    return response.data;
  }

  async getRecent(): Promise<Denuncia[]> {
    const response = await apiClient.get<Denuncia[]>('/denuncias');
    return response.data;
  }

  async getOne(id: string): Promise<Denuncia> {
    const response = await apiClient.get<Denuncia>(`/denuncias/${id}`);
    return response.data;
  }

  async getMine(): Promise<Denuncia[]> {
    const response = await apiClient.get<Denuncia[]>('/denuncias/mias');
    return response.data;
  }

  async update(id: string, payload: UpdateDenunciaPayload): Promise<Denuncia> {
    const response = await apiClient.patch<Denuncia>(`/denuncias/${id}`, payload);
    return response.data;
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/denuncias/${id}`);
  }
}

export default new DenunciaService();

/**
 * Presentación de una denuncia en la interfaz. El sistema atiende un único tipo
 * de caso, así que no hay categorías que distinguir.
 */
export const DENUNCIA_META = {
  label: 'Desaparición',
  icon: 'search',
  color: '#FF3B30',
};
