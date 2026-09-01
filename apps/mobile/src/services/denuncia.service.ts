import { apiClient } from './api';

/** Cuánto respaldo tiene el caso. Determina si se difunde, con qué alcance. */
export type NivelConfianza = 'REGISTRADA' | 'PROVISIONAL' | 'CORROBORADA';

/** Si la denuncia sigue viva, y por qué dejó de estarlo. */
export type EstadoDenuncia = 'ACTIVA' | 'CADUCADA' | 'INVALIDADA' | 'CERRADA';

export interface Denuncia {
  id: string;
  denunciante_id: string;
  nombre_persona_buscada: string | null;
  description: string;
  latitude: number;
  longitude: number;
  photo_base64: string | null;
  nivel_confianza: NivelConfianza;
  estado: EstadoDenuncia;
  radio_actual_m: number | null;
  expira_en: string | null;
  numero_caso_felcc: string | null;
  created_at: string;
  distance_meters?: number;
}

export interface CreateDenunciaPayload {
  nombre_persona_buscada: string;
  /** Documento de la persona buscada. El servidor solo guarda su hash. */
  ci_persona_buscada: string;
  description: string;
  latitude: number;
  longitude: number;
  photo_base64?: string;
}

/** Cómo se le explica a una persona el nivel de confianza de su denuncia. */
export const NIVEL_META: Record<
  NivelConfianza,
  { label: string; desc: string; color: string }
> = {
  REGISTRADA: {
    label: 'Registrada',
    desc: 'Solo tú la ves. Firma la declaración para que se difunda.',
    color: '#8E8E93',
  },
  PROVISIONAL: {
    label: 'Difundida',
    desc: 'Se está alertando a la zona cercana.',
    color: '#FF9500',
  },
  CORROBORADA: {
    label: 'Corroborada',
    desc: 'Con respaldo. Se alerta a una zona más amplia.',
    color: '#34C759',
  },
};

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
