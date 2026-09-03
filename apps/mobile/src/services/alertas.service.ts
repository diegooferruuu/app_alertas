import { apiClient } from './api';

export type Plataforma = 'android' | 'ios';

export interface Dispositivo {
  id: string;
  plataforma: Plataforma;
  ultima_actividad: string;
}

class AlertasService {
  /**
   * Registra el aparato donde esta persona recibirá alertas.
   *
   * Sin esto la consulta de destinatarios del servidor no devuelve a nadie: exige
   * dispositivo registrado, no solo ubicación.
   */
  async registrarDispositivo(
    pushToken: string,
    plataforma: Plataforma,
  ): Promise<Dispositivo> {
    const response = await apiClient.post<Dispositivo>('/alertas/dispositivos', {
      push_token: pushToken,
      plataforma,
    });
    return response.data;
  }

  async misDispositivos(): Promise<Dispositivo[]> {
    const response = await apiClient.get<Dispositivo[]>('/alertas/dispositivos');
    return response.data;
  }

  /**
   * Informa la última posición conocida.
   *
   * El servidor descarta las ubicaciones más viejas que el umbral configurado
   * (72 h por defecto) al decidir a quién alcanza una alerta, así que esto tiene
   * que repetirse: no basta con enviarla una vez al instalar la app.
   */
  async actualizarUbicacion(latitude: number, longitude: number): Promise<void> {
    await apiClient.put('/alertas/ubicacion', { latitude, longitude });
  }
}

export const alertasService = new AlertasService();
export default alertasService;
