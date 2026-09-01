import axios from 'axios';
import { storage } from '../utils/storage';

// En dispositivo físico usa la IP de tu Mac. En simulador/web usa localhost.
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://192.168.6.200:3000/api';

// Instancia axios compartida por todos los servicios (auth, denuncias, ...).
export const apiClient = axios.create({ baseURL: API_URL });

// Adjunta el token de acceso a cada request
apiClient.interceptors.request.use(
  async (config) => {
    const token = await storage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Refresca el token automáticamente ante un 401
apiClient.interceptors.response.use(
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
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        await storage.removeItem('accessToken');
        await storage.removeItem('refreshToken');
        await storage.removeItem('userId');
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);
