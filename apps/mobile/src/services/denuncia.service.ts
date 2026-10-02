import { apiClient } from './api';

/** Cuánto respaldo tiene el caso. Determina si se difunde, con qué alcance. */
export type NivelConfianza = 'REGISTRADA' | 'PROVISIONAL' | 'CORROBORADA';

/** Si la denuncia sigue viva, y por qué dejó de estarlo. */
export type EstadoDenuncia = 'ACTIVA' | 'CADUCADA' | 'INVALIDADA' | 'CERRADA';

export interface Denuncia {
  id: string;
  /**
   * Si la firmó quien está usando la aplicación.
   *
   * El servidor no envía el identificador de quien denunció, ni siquiera al
   * propio autor: era el primer eslabón para llegar desde una denuncia hasta la
   * ficha de quien la puso. Lo único que hacía falta de aquel campo era esto.
   */
  es_mia: boolean;
  nombre_persona_buscada: string | null;
  /**
   * Relato libre. Retirado del formulario: solo lo traen las denuncias
   * anteriores al desglose en campos cerrados.
   */
  description: string | null;
  fecha_nacimiento: string | null;
  sexo: string | null;
  estatura_rango: string | null;
  contextura: string | null;
  color_piel: string | null;
  color_cabello: string | null;
  color_ojos: string | null;
  senas_particulares: string[] | null;
  ultimo_avistamiento_en: string | null;
  prenda_superior: string | null;
  color_prenda_superior: string | null;
  prenda_inferior: string | null;
  color_prenda_inferior: string | null;
  calzado: string | null;
  circunstancia: string | null;
  condicion_relevante: string[] | null;
  latitude: number;
  longitude: number;
  /**
   * Solo llega en el detalle de una denuncia.
   *
   * Las consultas de listado y de cercanía no traen el contenido de las
   * imágenes: son la ruta crítica del sistema y no pueden arrastrar cientos de
   * kilobytes por fila.
   */
  fotografias?: Array<{ id: string; contenido: string }>;
  nivel_confianza: NivelConfianza;
  estado: EstadoDenuncia;
  radio_actual_m: number | null;
  expira_en: string | null;
  numero_caso_felcc: string | null;
  /** Cuándo la dio por terminada quien la presentó: «La encontramos». */
  cerrada_en: string | null;
  created_at: string;
  distance_meters?: number;
}

/**
 * Lo que se envía al crear una denuncia.
 *
 * No existe aquí ningún campo de texto libre salvo el nombre de la persona
 * buscada, ni ningún campo referido a un tercero. El servidor rechaza con 400
 * cualquier propiedad que no esté en esta lista, así que añadir una aquí sin
 * añadirla allá no abre ninguna puerta: la cierra el servidor.
 */
export interface CreateDenunciaPayload {
  nombre_persona_buscada: string;
  /** Documento de la persona buscada. El servidor solo guarda su hash. */
  ci_persona_buscada: string;
  fecha_nacimiento: string;
  sexo: string;
  estatura_rango: string;
  contextura: string;
  color_piel: string;
  color_cabello: string;
  color_ojos: string;
  senas_particulares?: string[];
  ultimo_avistamiento_en: string;
  prenda_superior: string;
  color_prenda_superior: string;
  prenda_inferior: string;
  color_prenda_inferior: string;
  calzado?: string;
  circunstancia: string;
  condicion_relevante?: string[];
  latitude: number;
  longitude: number;
  /**
   * Obligatoria, salvo que la persona buscada sea menor de edad: su alerta no
   * lleva retrato. Ver `utils/minoria-edad`; el servidor impone la misma regla
   * y rechaza el campo si llega en ese caso.
   */
  fotografia_base64?: string;
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
    // Lo leen también quienes no la presentaron: no se le habla al autor.
    desc: 'Venció su plazo sin el caso de la FELCC. Sigue registrada y puede volver a difundirse con él.',
    color: '#8E8E93',
  },
  INVALIDADA: {
    label: 'Alerta retirada',
    desc: 'La persona reportada cerró esta alerta.',
    color: '#B32C24',
  },
  CERRADA: {
    label: 'Caso cerrado',
    // Solo la ven quien la presentó y la persona reportada: para los demás,
    // una cerrada ya no existe.
    desc: 'Quien la presentó informó que la persona apareció.',
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
    desc: 'Todavía no se difunde. Firma la declaración para que se alerte a la zona.',
    color: '#8E8E93',
  },
  PROVISIONAL: {
    label: 'Difundida',
    desc: 'Se está alertando a la zona cercana.',
    color: '#FF9500',
  },
  CORROBORADA: {
    label: 'Corroborada',
    desc: 'Respaldada por el caso de la FELCC. Se alerta a una zona más amplia.',
    color: '#34C759',
  },
};

/**
 * Corrección de una denuncia sin declarar. Mismos campos cerrados que al crear,
 * todos opcionales. Sin `description`: el relato libre se retiró, y admitirlo al
 * editar dejaría abierta la puerta que se cerró al crear.
 */
export interface UpdateDenunciaPayload {
  nombre_persona_buscada?: string;
  fecha_nacimiento?: string;
  sexo?: string;
  estatura_rango?: string;
  contextura?: string;
  color_piel?: string;
  color_cabello?: string;
  color_ojos?: string;
  senas_particulares?: string[];
  ultimo_avistamiento_en?: string;
  prenda_superior?: string;
  color_prenda_superior?: string;
  prenda_inferior?: string;
  color_prenda_inferior?: string;
  calzado?: string;
  circunstancia?: string;
  condicion_relevante?: string[];
  fotografia_base64?: string;
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

  /**
   * «La encontramos»: da el caso por terminado. La alerta deja de difundirse y
   * no se puede reactivar. La persona reportada conserva su derecho a
   * declararla falsa.
   */
  async darPorEncontrada(id: string): Promise<Denuncia & { mensaje: string }> {
    const response = await apiClient.post<Denuncia & { mensaje: string }>(
      `/denuncias/${id}/encontrada`,
    );
    return response.data;
  }

  // No hay método para eliminar: el servidor no expone esa operación. Una
  // denuncia queda atribuida a quien la firmó y no se puede hacer desaparecer.
}

export default new DenunciaService();

/** Primera fotografía de una denuncia, si el detalle la trajo. */
export const primeraFotografia = (denuncia: Denuncia): string | null =>
  denuncia.fotografias?.[0]?.contenido ?? null;

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

/** Texto legal vigente de la declaración jurada. */
export interface TextoLegal {
  version_id: string;
  version: string;
  texto: string;
  hash_texto: string;
}

export interface Vinculo {
  valor: string;
  etiqueta: string;
}

export interface FirmarPayload {
  version_texto_legal_id: string;
  vinculo_declarado: string;
  nombre_escrito: string;
  device_id?: string;
  /** La firma del teléfono: obligatoria. Ver `firma-dispositivo.ts`. */
  clave_dispositivo_id: string;
  firma_dispositivo: string;
}

/**
 * Con qué nivel quedó la denuncia. CORROBORADA si el caso de la FELCC ya
 * estaba registrado al firmar: sale con el alcance ampliado, en una sola
 * emisión.
 */
export interface ResultadoFirma {
  firmada: true;
  nivel_confianza: NivelConfianza;
}

class DeclaracionService {
  async textoLegal(): Promise<TextoLegal> {
    const response = await apiClient.get<TextoLegal>('/declaraciones/texto-legal');
    return response.data;
  }

  /**
   * Los vínculos los sirve el servidor.
   *
   * Mantener aquí una copia de la lista permitiría que se desincronizara y que
   * la app ofreciera un valor que el servidor rechaza.
   */
  async vinculos(): Promise<Vinculo[]> {
    const response = await apiClient.get<Vinculo[]>('/declaraciones/vinculos');
    return response.data;
  }

  /** El hash del contenido que el teléfono va a firmar. */
  async contenidoAFirmar(denunciaId: string): Promise<{ hash_contenido_denuncia: string }> {
    const response = await apiClient.get<{ hash_contenido_denuncia: string }>(
      `/declaraciones/denuncias/${denunciaId}/contenido`,
    );
    return response.data;
  }

  /** Registra la clave pública del teléfono. Idempotente: se llama antes de cada firma. */
  async registrarClave(clavePublica: string): Promise<{ id: string }> {
    const response = await apiClient.post<{ id: string }>('/declaraciones/claves', {
      clave_publica: clavePublica,
    });
    return response.data;
  }

  async firmar(denunciaId: string, payload: FirmarPayload): Promise<ResultadoFirma> {
    const response = await apiClient.post<ResultadoFirma>(
      `/declaraciones/denuncias/${denunciaId}/firmar`,
      payload,
    );
    return response.data;
  }

  /**
   * La única vía de corroboración: el número de caso de la denuncia formal ante
   * la FELCC. La corroboración por la firma de otra persona se retiró.
   *
   * Después de firmar amplía el alcance de inmediato, y revive una alerta
   * vencida. Antes de firmar solo guarda el número (sigue REGISTRADA) y la firma
   * la difunde ya corroborada; la app lo ofrece ahí únicamente a quien tiene una
   * falta, que sin el caso no puede difundir.
   */
  async registrarCasoFelcc(
    denunciaId: string,
    numeroCaso: string,
  ): Promise<{ nivel_confianza: NivelConfianza }> {
    const response = await apiClient.post<{ nivel_confianza: NivelConfianza }>(
      `/declaraciones/denuncias/${denunciaId}/caso-felcc`,
      { numero_caso: numeroCaso },
    );
    return response.data;
  }
}

export const declaracionService = new DeclaracionService();
