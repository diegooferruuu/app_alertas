import { Platform } from 'react-native';
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

/**
 * `expo-notifications` se carga **solo cuando hace falta**, nunca al importar.
 *
 * Importarlo tumba la aplicación en Expo Go sobre Android. No por nada que haga
 * este archivo: el propio paquete, en
 * `DevicePushTokenAutoRegistration.fx.js`, llama a `addPushTokenListener` en
 * ámbito global, y desde el SDK 53 esa llamada lanza en Expo Go Android porque
 * el push remoto se retiró. El error llega como `[runtime not ready]` —antes de
 * que React exista— así que ningún `try/catch` de este archivo ni ninguna
 * barrera de errores puede atraparlo: lo único que sirve es no importarlo.
 *
 * Un `require` dentro de una función sí es perezoso en Metro, a diferencia de un
 * `import` de arriba, que se evalúa siempre.
 *
 * La consecuencia es la correcta: en Expo Go no hay push —nunca lo hubo— pero la
 * aplicación arranca y todo lo demás funciona. El push llega con el dev build.
 */
type ModuloNotificaciones = typeof import('expo-notifications');

/** `undefined` = aún no se intentó; `null` = se intentó y no está disponible. */
let modulo: ModuloNotificaciones | null | undefined;

/**
 * Expo Go sobre Android: el único entorno donde importar el módulo revienta.
 *
 * `storeClient` es lo que informa `expo-constants` cuando la aplicación corre
 * dentro de Expo Go, en vez de en un build propio.
 */
const esExpoGoEnAndroid =
  Platform.OS === 'android' &&
  Constants.executionEnvironment === 'storeClient';

const cargarNotificaciones = (): ModuloNotificaciones | null => {
  if (modulo !== undefined) return modulo;

  // Se comprueba **antes** de requerir, y no se atrapa después, porque atraparlo
  // no basta: Metro reporta por su cuenta el fallo al evaluar un módulo, así que
  // la caja roja sale igual aunque el `try/catch` haga su trabajo. La única
  // forma de no ver el error es no provocarlo.
  if (esExpoGoEnAndroid) {
    console.warn(
      'Sin notificaciones push: Expo Go no las tiene en Android desde el SDK 53. ' +
        'Llegan con el development build.',
    );
    modulo = null;
    return modulo;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cargado = require('expo-notifications');

    // Dos comprobaciones, y las dos hacen falta. `?.default` porque el módulo es
    // ESM y, según cómo lo empaquete Metro, la API puede venir ahí en vez de en
    // la raíz. Y la de `getPermissionsAsync` porque cuando la evaluación del
    // módulo revienta a medias —lo que pasa en Expo Go sobre Android— el
    // `require` no lanza: devuelve un objeto incompleto, o nada. Sin
    // comprobarlo, el fallo salía después como «Cannot read property
    // 'setNotificationHandler' of undefined», que parece un error de este
    // archivo y no lo es.
    const api = (cargado?.default ?? cargado) as ModuloNotificaciones | undefined;
    if (!api || typeof api.getPermissionsAsync !== 'function') {
      throw new Error(
        'el módulo no expone su API aquí; en Expo Go el push remoto no existe desde el SDK 53',
      );
    }

    modulo = api;
  } catch (error) {
    console.warn(
      `Sin notificaciones push en este entorno: ${(error as Error).message}`,
    );
    modulo = null;
    return modulo;
  }

  // Configurar el manejador va aparte y con su propio `try`: que no se pueda
  // decidir cómo se muestra una notificación en primer plano no invalida el
  // resto del módulo, que sí sirve para pedir permiso y registrar el aparato.
  try {
    modulo.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch (error) {
    console.warn(
      `Las alertas en primer plano no se mostrarán: ${(error as Error).message}`,
    );
  }

  return modulo;
};

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

  const Notifications = cargarNotificaciones();
  if (!Notifications) {
    return {
      registrado: false,
      motivo:
        'Este entorno no tiene notificaciones push. En Expo Go no existen desde el SDK 53: hace falta un development build.',
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
  try {
    return suscribirseAToques(navegar);
  } catch (error) {
    // Registrar el oyente puede fallar donde el push remoto no existe —Expo Go
    // sobre Android desde el SDK 53—. Esto se llama desde un efecto del
    // componente raíz, y un error ahí no tiene quién lo atrape: React desmonta
    // el árbol entero y la aplicación se queda en blanco. No poder reaccionar a
    // una notificación no puede costar la aplicación.
    console.warn(
      `Sin reacción a notificaciones tocadas: ${(error as Error).message}`,
    );
    return () => {};
  }
}

function suscribirseAToques(
  navegar: (pantalla: string, params?: Record<string, unknown>) => void,
): () => void {
  const Notifications = cargarNotificaciones();
  if (!Notifications) return () => {};

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
