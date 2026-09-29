import axios from 'axios';
import { storage } from '../utils/storage';

/**
 * Dirección del servidor. En teléfono físico tiene que ser la IP de la máquina
 * en la red local: `localhost` lo resuelve el teléfono contra sí mismo.
 *
 * El valor de reserva es `localhost` y no una IP concreta a propósito. Antes
 * había una escrita a mano —`192.168.6.200`— que dejó de existir al cambiar de
 * red, y el síntoma no era un error claro sino la aplicación intentando hablar
 * con una máquina que no está. `localhost` falla igual, pero falla donde se
 * entiende: en el simulador funciona y en el teléfono se ve enseguida que falta
 * configurar la variable.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

/**
 * Espera máxima de cada petición.
 *
 * Sin esto, axios espera indefinidamente. Con el servidor inalcanzable —otra
 * red, la máquina apagada, la IP cambiada— el arranque se queda esperando un
 * perfil que no va a llegar y la aplicación muestra el indicador de carga para
 * siempre, sin decir qué pasa. Un fallo de red tiene que verse como un fallo de
 * red, no como un cuelgue.
 */
const ESPERA_MAXIMA_MS = 15_000;

// Instancia axios compartida por todos los servicios (auth, denuncias, ...).
export const apiClient = axios.create({
  baseURL: API_URL,
  timeout: ESPERA_MAXIMA_MS,
});

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
