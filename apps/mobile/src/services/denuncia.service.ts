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

/**
 * Cómo se le explica a una persona el estado de su denuncia.
 *
 * Una denuncia caducada conserva su nivel de confianza —es el registro de hasta
 * dónde se difundió—, así que mostrar el nivel a secas diría «Difundida» sobre
 * una alerta que ya no se está difundiendo. Cuando el estado no es ACTIVA, manda
 * el estado.
 */
export const ESTADO_META: Record<
  Exclude<EstadoDenuncia, 'ACTIVA'>,
  { label: string; desc: string; color: string }
> = {
  CADUCADA: {
    label: 'Alerta vencida',
    desc: 'Dejó de difundirse por falta de respaldo. El caso sigue registrado.',
    color: '#8E8E93',
  },
  INVALIDADA: {
    label: 'Alerta retirada',
    desc: 'La persona reportada retiró esta alerta.',
    color: '#B32C24',
  },
  CERRADA: {
    label: 'Caso cerrado',
    desc: 'Este caso terminó.',
    color: '#0E7247',
  },
};

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

  // No hay método para eliminar: el servidor no expone esa operación. Una
  // denuncia queda atribuida a quien la firmó y no se puede hacer desaparecer.
}

export default new DenunciaService();

/**
 * Qué mostrarle a una persona sobre su denuncia: el estado cuando dejó de estar
 * activa, y el nivel de confianza mientras siga en curso.
 */
export const situacionDe = (
  denuncia: Pick<Denuncia, 'estado' | 'nivel_confianza'>,
): { label: string; desc: string; color: string } =>
  denuncia.estado === 'ACTIVA'
    ? NIVEL_META[denuncia.nivel_confianza]
    : ESTADO_META[denuncia.estado];

/**
 * Presentación de una denuncia en la interfaz. El sistema atiende un único tipo
 * de caso, así que no hay categorías que distinguir.
 */
export const DENUNCIA_META = {
  label: 'Desaparición',
  icon: 'search',
  color: '#FF3B30',
};
