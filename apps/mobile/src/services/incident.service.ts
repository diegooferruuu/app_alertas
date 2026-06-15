import { apiClient } from './api';

export type IncidentCategory = 'desaparicion';

export interface Incident {
  id: string;
  reporter_id: string;
  category: IncidentCategory;
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
  description: string;
  latitude: number;
  longitude: number;
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
