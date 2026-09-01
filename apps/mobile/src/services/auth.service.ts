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

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  documento_registrado: boolean;
  reputation_score: number;
  role: 'citizen' | 'admin' | 'moderator';
  is_suspended: boolean;
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
  }): Promise<any> {
    return apiClient.post('/auth/documento/registrar', payload);
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
