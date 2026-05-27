import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

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
        const token = await SecureStore.getItemAsync('accessToken');
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
            const refreshToken = await SecureStore.getItemAsync('refreshToken');
            if (refreshToken) {
              const response = await axios.post(`${API_URL}/auth/refresh`, {
                refreshToken,
              });
              const { accessToken, refreshToken: newRefreshToken } = response.data;

              await SecureStore.setItemAsync('accessToken', accessToken);
              await SecureStore.setItemAsync('refreshToken', newRefreshToken);

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
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('refreshToken');
    await SecureStore.deleteItemAsync('userId');
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
    await SecureStore.setItemAsync('accessToken', data.accessToken);
    await SecureStore.setItemAsync('refreshToken', data.refreshToken);
    await SecureStore.setItemAsync('userId', data.user.id);
  }
}

export default new AuthService();
