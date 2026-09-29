import * as Location from 'expo-location';
import alertasService from './alertas.service';

/**
 * Informe de la última posición conocida (fase 3).
 *
 * La consulta que decide a quién alcanza una alerta exige dos cosas: dispositivo
 * registrado y **ubicación reciente**. Hasta ahora la app pedía la ubicación para
 * pintar el mapa pero nunca se la enviaba al servidor, así que `last_location`
 * quedaba nula y nadie era alcanzable.
 *
 * A diferencia del push, esto sí funciona sin un development build.
 */

export interface ResultadoUbicacion {
  reportada: boolean;
  motivo?: string;
}

export async function reportarUbicacion(): Promise<ResultadoUbicacion> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return {
        reportada: false,
        motivo: 'No se concedió permiso de ubicación.',
      };
    }

    // Precisión moderada a propósito: lo que se guarda es la referencia para un
    // radio de kilómetros, no una posición fina, y pedir más gasta batería sin
    // cambiar a quién alcanza la alerta.
    const posicion = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    await alertasService.actualizarUbicacion(
      posicion.coords.latitude,
      posicion.coords.longitude,
    );
    return { reportada: true };
  } catch (error: any) {
    return {
      reportada: false,
      motivo: error?.message ?? 'No se pudo obtener la ubicación.',
    };
  }
}
