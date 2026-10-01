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
 * Si la cuenta está suspendida. Es lo único que el estado guarda: las faltas
 * no tienen plazo, y lo que restringen lo explica `GET /usuarios/me/sanciones`
 * (ver `sanciones.service.ts`).
 */
export type EstadoCuenta = 'ACTIVA' | 'SUSPENDIDA';

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  documento_registrado: boolean;
  estado_cuenta: EstadoCuenta;
}

/**
 * Lo que responde el servidor al registrar el documento.
 *
 * `denuncias_que_te_identifican` es la vía de acceso de H4.4: una denuncia pudo
 * presentarse contra este documento antes de que la persona tuviera cuenta. El
 * servidor lo dice aquí mismo para que la app pueda llevarla a cerrarla de
 * inmediato —«minutos, no horas»— sin depender de que llegue la notificación.
 */
export interface RegistroDocumentoResultado {
  documento_registrado: boolean;
  message: string;
  denuncias_que_te_identifican: number;
}

/**
 * Datos con los que se crea una cuenta.
 *
 * El nombre viaja desglosado; el servidor compone con él el nombre completo y
 * rechaza un `full_name` enviado desde aquí. Es un objeto y no una lista de
 * argumentos porque con siete campos —cuatro de ellos cadenas de nombre— el
 * orden posicional es una invitación a cruzar el apellido con el teléfono.
 */
export interface DatosDeRegistro {
  email: string;
  password: string;
  phone: string;
  primer_nombre: string;
  /** Se omite si la persona no tiene; no se manda cadena vacía. */
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido: string;
}

class AuthService {
  async register(datos: DatosDeRegistro): Promise<LoginResponse> {
    const response = await apiClient.post<LoginResponse>('/auth/register', datos);
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
