import axios from 'axios';
import { storage } from '../utils/storage';

const API_URL = process.env.MOBILE_API_URL || 'http://localhost:3000/api';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    identity_verified: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  identity_verified: boolean;
  reputation_score: number;
}

class AuthService {
  private axiosInstance = axios.create({
    baseURL: API_URL,
  });

  constructor() {
    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const token = await storage.getItem('accessToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            const refreshToken = await storage.getItem('refreshToken');
            if (refreshToken) {
              const response = await axios.post(`${API_URL}/auth/refresh`, {
                refreshToken,
              });
              const { accessToken, refreshToken: newRefreshToken } = response.data;

              await storage.setItem('accessToken', accessToken);
              await storage.setItem('refreshToken', newRefreshToken);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return this.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // Refresh token failed, logout user
            await this.logout();
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      },
    );
  }

  async register(email: string, password: string, full_name: string, phone: string, id_card_base64: string): Promise<LoginResponse> {
    const response = await this.axiosInstance.post<LoginResponse>('/auth/register', {
      email,
      password,
      full_name,
      phone,
      id_card_base64,
    });
    await this.saveTokens(response.data);
    return response.data;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await this.axiosInstance.post<LoginResponse>('/auth/login', {
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

  async verifyIdentity(id_card_base64: string): Promise<any> {
    return this.axiosInstance.post('/auth/verify-identity', {
      id_card_base64,
    });
  }

  async getProfile(): Promise<User> {
    const response = await this.axiosInstance.get<User>('/auth/me');
    return response.data;
  }

  private async saveTokens(data: LoginResponse): Promise<void> {
    await storage.setItem('accessToken', data.accessToken);
    await storage.setItem('refreshToken', data.refreshToken);
    await storage.setItem('userId', data.user.id);
  }
}

export default new AuthService();
