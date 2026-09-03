import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import alertasService, { Plataforma } from './alertas.service';

/**
 * Registro del dispositivo para recibir alertas (fase 3).
 *
 * Nada de esto funciona en Expo Go: desde el SDK 53 las notificaciones push
 * remotas exigen un *development build*. Tampoco en el simulador de iOS, que no
 * puede obtener un token. Por eso cada paso devuelve un motivo legible en lugar
 * de lanzar: que no haya push no puede impedir usar el resto de la aplicación.
 */

/** Con la app en primer plano, la alerta igual se muestra. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export interface ResultadoRegistro {
  registrado: boolean;
  motivo?: string;
}

const projectId = (): string | undefined => {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId;
  // El valor de plantilla no sirve: `getExpoPushTokenAsync` necesita un proyecto
  // EAS real. Se trata como ausente para dar un motivo claro en vez de un error
  // opaco de la pasarela.
  return !id || id === 'your-project-id' ? undefined : id;
};

/**
 * Pide permiso, obtiene el token de Expo y registra el aparato en el servidor.
 *
 * Es idempotente del lado del servidor: reenviar el mismo token actualiza el
 * registro en lugar de duplicarlo, así que puede llamarse en cada arranque.
 */
export async function registrarDispositivoParaAlertas(): Promise<ResultadoRegistro> {
  if (!Device.isDevice) {
    return {
      registrado: false,
      motivo: 'Las notificaciones push no funcionan en un simulador.',
    };
  }

  if (Platform.OS === 'android') {
    // Sin canal, Android 8+ no muestra la notificación.
    await Notifications.setNotificationChannelAsync('alertas', {
      name: 'Alertas de desaparición',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }

  const { status: existente } = await Notifications.getPermissionsAsync();
  let status = existente;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    return {
      registrado: false,
      motivo: 'No se concedió permiso para recibir notificaciones.',
    };
  }

  const id = projectId();
  if (!id) {
    return {
      registrado: false,
      motivo:
        'Falta el projectId de EAS en app.json: sin él no se puede emitir un token de push.',
    };
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: id,
    });
    await alertasService.registrarDispositivo(token, Platform.OS as Plataforma);
    return { registrado: true };
  } catch (error: any) {
    return {
      registrado: false,
      motivo: error?.message ?? 'No se pudo obtener el token de notificaciones.',
    };
  }
}

/**
 * Suscribe la reacción a una alerta tocada.
 *
 * El servidor manda `denuncia_id` y `motivo` en los datos de la notificación, así
 * que se puede llevar a la persona directo a lo que le concierne: al interruptor
 * si la denuncia la identifica, o al detalle si es una alerta de su zona.
 */
export function alTocarUnaAlerta(
  navegar: (pantalla: string, params?: Record<string, unknown>) => void,
): () => void {
  const suscripcion = Notifications.addNotificationResponseReceivedListener(
    (respuesta) => {
      const datos = respuesta.notification.request.content.data as {
        denuncia_id?: string;
        motivo?: string;
      };
      if (!datos?.denuncia_id) return;

      if (datos.motivo === 'coincidencia_documento') {
        navegar('AlertasSobreMi');
      } else {
        navegar('DenunciaDetail', { id: datos.denuncia_id });
      }
    },
  );

  return () => suscripcion.remove();
}
