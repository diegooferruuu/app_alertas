import { storage } from '../utils/storage';
import { apiClient } from './api';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    documento_registrado: boolean;
  };
}

/**
 * Estado de la cuenta frente a las sanciones (§5.4).
 *
 * Sustituye al antiguo booleano `is_suspended`, que el servidor ya no devuelve:
 * la sanción es graduada y un booleano no distinguía «restringida un tiempo» de
 * «suspendida».
 */
export type EstadoCuenta = 'ACTIVA' | 'RESTRINGIDA' | 'SUSPENDIDA';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  documento_registrado: boolean;
  reputation_score: number;
  role: 'citizen' | 'admin' | 'moderator';
  estado_cuenta: EstadoCuenta;
  /** Hasta cuándo dura la restricción. Nulo si no hay plazo que cumplir. */
  restringida_hasta: string | null;
}

export interface SancionVisible {
  titulo: string;
  detalle: string;
  color: string;
}

/**
 * Cómo se le explica a una persona su sanción, o `null` si no hay ninguna
 * vigente.
 *
 * Espeja la regla del servidor: una restricción cuyo plazo ya venció **no
 * restringe**, aunque la cuenta siga etiquetada como RESTRINGIDA. Avisar ahí le
 * diría a alguien que no puede reportar cuando sí puede.
 */
export function sancionVigente(user: User | null): SancionVisible | null {
  if (!user) return null;

  if (user.estado_cuenta === 'SUSPENDIDA') {
    return {
      titulo: 'Cuenta suspendida',
      detalle:
        'No puedes crear denuncias ni firmar declaraciones. Sí puedes retirar alertas que te identifiquen.',
      color: '#B32C24',
    };
  }

  if (user.estado_cuenta === 'RESTRINGIDA') {
    const hasta = user.restringida_hasta ? new Date(user.restringida_hasta) : null;
    if (!hasta || hasta <= new Date()) return null;
    return {
      titulo: 'Cuenta restringida',
      detalle: `No puedes crear denuncias nuevas hasta el ${hasta.toLocaleDateString()}. Conservas el resto de funciones.`,
      color: '#8F5600',
    };
  }

  return null;
}

/**
 * Lo que responde el servidor al registrar el documento.
 *
 * `denuncias_que_te_identifican` es la vía de acceso de H4.4: una denuncia pudo
 * presentarse contra este documento antes de que la persona tuviera cuenta. El
 * servidor lo dice aquí mismo para que la app pueda llevarla al interruptor de
 * inmediato —«minutos, no horas»— sin depender de que llegue la notificación.
 */
export interface RegistroDocumentoResultado {
  documento_registrado: boolean;
  message: string;
  denuncias_que_te_identifican: number;
}

class AuthService {
  async register(
    email: string,
    password: string,
    full_name: string,
    phone: string,
  ): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/register', {
      email,
      password,
      full_name,
      phone,
    });
    await this.saveTokens(response.data);
    return response.data;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/login', {
      email,
      password,
    });
    await this.saveTokens(response.data);
    return response.data;
  }

  async logout(): Promise<void> {
    await storage.removeItem('accessToken');
    await storage.removeItem('refreshToken');
    await storage.removeItem('userId');
  }

  async extraerDatosDocumento(payload: {
    id_front_base64: string;
    id_back_base64: string;
    personal_data: {
      full_name: string;
      ci_number: string;
      birth_place: string;
      birth_date: string;
    };
  }): Promise<any> {
    return apiClient.post('/auth/documento/extraer', payload);
  }

  async registrarDocumento(payload: {
    id_front_base64: string;
    id_back_base64: string;
    selfie_base64: string;
    personal_data: {
      full_name: string;
      ci_number: string;
      birth_place: string;
      birth_date: string;
    };
  }): Promise<RegistroDocumentoResultado> {
    const response = await apiClient.post<RegistroDocumentoResultado>(
      '/auth/documento/registrar',
      payload,
    );
    return response.data;
  }

  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>('/auth/me');
    return response.data;
  }

  private async saveTokens(data: LoginResponse): Promise<void> {
    await storage.setItem('accessToken', data.accessToken);
    await storage.setItem('refreshToken', data.refreshToken);
    await storage.setItem('userId', data.user.id);
  }
}

export default new AuthService();
