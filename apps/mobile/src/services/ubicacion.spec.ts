import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import * as Location from 'expo-location';
import alertasService from './alertas.service';
import { reportarUbicacion } from './ubicacion';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('./alertas.service', () => ({
  __esModule: true,
  default: { actualizarUbicacion: jest.fn() },
}));

const ubicacion = jest.mocked(Location);
const servidor = jest.mocked(alertasService);

const permiso = (status: string) => ({ status }) as any;

beforeEach(() => {
  jest.clearAllMocks();
  ubicacion.requestForegroundPermissionsAsync.mockResolvedValue(permiso('granted'));
  ubicacion.getForegroundPermissionsAsync.mockResolvedValue(permiso('granted'));
  ubicacion.getCurrentPositionAsync.mockResolvedValue({
    coords: { latitude: -17.39, longitude: -66.16 },
  } as any);
  servidor.actualizarUbicacion.mockResolvedValue(undefined);
});

describe('reportarUbicacion', () => {
  it('al entrar pide el permiso e informa la posición', async () => {
    const resultado = await reportarUbicacion(true);

    expect(resultado).toEqual({ reportada: true });
    expect(ubicacion.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(ubicacion.getCurrentPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mayShowUserSettingsDialog: true }),
    );
    expect(servidor.actualizarUbicacion).toHaveBeenCalledWith(-17.39, -66.16);
  });

  it('al volver al primer plano no abre ninguna pantalla del sistema', async () => {
    // En Android, cualquiera de las dos saca la app del primer plano y la
    // devuelve, y esa vuelta dispara otro informe: el ciclo de un informe por
    // segundo.
    const resultado = await reportarUbicacion(false);

    expect(resultado).toEqual({ reportada: true });
    expect(ubicacion.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(ubicacion.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(ubicacion.getCurrentPositionAsync).toHaveBeenCalledWith(
      expect.objectContaining({ mayShowUserSettingsDialog: false }),
    );
  });

  it('sin permiso no busca la posición ni informa nada', async () => {
    ubicacion.getForegroundPermissionsAsync.mockResolvedValue(permiso('denied'));

    const resultado = await reportarUbicacion(false);

    expect(resultado.reportada).toBe(false);
    expect(ubicacion.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(servidor.actualizarUbicacion).not.toHaveBeenCalled();
  });
});
