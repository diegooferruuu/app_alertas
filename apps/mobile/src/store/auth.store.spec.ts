import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import authService from '../services/auth.service';
import { storage } from '../utils/storage';
import { useAuthStore } from './auth.store';

jest.mock('../services/auth.service', () => ({
  __esModule: true,
  default: { getProfile: jest.fn() },
}));
jest.mock('../utils/storage', () => ({
  storage: { getItem: jest.fn() },
}));

const servidor = jest.mocked(authService);
const guardado = jest.mocked(storage);

const PERFIL = {
  id: 'u1',
  email: 'ana@demo.bo',
  full_name: 'Ana Quispe Vargas',
  documento_registrado: true,
} as any;

describe('Retomar la sesión al abrir la app', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    useAuthStore.setState({ user: null, isAuthenticated: false, documentoRegistrado: false });
  });

  it('con una sesión guardada, entra sin pedir la contraseña', async () => {
    guardado.getItem.mockResolvedValue('token');
    servidor.getProfile.mockResolvedValue(PERFIL);

    await useAuthStore.getState().restaurarSesion();

    expect(useAuthStore.getState()).toMatchObject({
      user: PERFIL,
      isAuthenticated: true,
      documentoRegistrado: true,
    });
  });

  it('sin sesión guardada, ni siquiera consulta al servidor', async () => {
    guardado.getItem.mockResolvedValue(null);

    await useAuthStore.getState().restaurarSesion();

    expect(servidor.getProfile).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('si la sesión venció y no se pudo renovar, pide entrar de nuevo', async () => {
    guardado.getItem.mockResolvedValue('token');
    servidor.getProfile.mockRejectedValue(new Error('401'));

    await useAuthStore.getState().restaurarSesion();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
