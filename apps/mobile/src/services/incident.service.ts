import { apiClient } from './api';

export type IncidentCategory = 'desaparicion';

export interface Incident {
  id: string;
  reporter_id: string;
  category: IncidentCategory;
  victim_name: string | null;
  description: string;
  latitude: number;
  longitude: number;
  photo_base64: string | null;
  status: 'activo' | 'verificado' | 'resuelto' | 'descartado';
  confirmations_count: number;
  created_at: string;
  distance_meters?: number;
}

export interface CreateIncidentPayload {
  category: IncidentCategory;
  victim_name: string;
  description: string;
  latitude: number;
  longitude: number;
  photo_base64?: string;
}

export interface UpdateIncidentPayload {
  victim_name?: string;
  description?: string;
  photo_base64?: string;
}

class IncidentService {
  async create(payload: CreateIncidentPayload): Promise<Incident> {
    const response = await apiClient.post<Incident>('/incidents', payload);
    return response.data;
  }

  async getNearby(lat: number, lng: number, radius = 5000): Promise<Incident[]> {
    const response = await apiClient.get<Incident[]>('/incidents/nearby', {
      params: { lat, lng, radius },
    });
    return response.data;
  }

  async getRecent(): Promise<Incident[]> {
    const response = await apiClient.get<Incident[]>('/incidents');
    return response.data;
  }

  async getOne(id: string): Promise<Incident> {
    const response = await apiClient.get<Incident>(`/incidents/${id}`);
    return response.data;
  }

  async getMine(): Promise<Incident[]> {
    const response = await apiClient.get<Incident[]>('/incidents/mine');
    return response.data;
  }

  async update(id: string, payload: UpdateIncidentPayload): Promise<Incident> {
    const response = await apiClient.patch<Incident>(`/incidents/${id}`, payload);
    return response.data;
  }

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/incidents/${id}`);
  }
}

export default new IncidentService();

// Metadatos de categorías (etiqueta + icono Ionicons + color) para la UI.
// Por ahora solo existe "desaparición". El acceso es defensivo por si llega
// algún dato con otra categoría desde el backend.
export interface CategoryMeta {
  label: string;
  icon: string; // nombre de icono Ionicons
  color: string;
}

const FALLBACK_META: CategoryMeta = {
  label: 'Incidente',
  icon: 'alert-circle',
  color: '#8E8E93',
};

export const CATEGORY_META: Record<string, CategoryMeta> = new Proxy(
  {
    desaparicion: { label: 'Desaparición', icon: 'search', color: '#FF3B30' },
  } as Record<string, CategoryMeta>,
  {
    get: (target, prop: string) => target[prop] ?? FALLBACK_META,
  },
);
