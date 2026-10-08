import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  registrarDispositivoParaAlertas,
  alTocarUnaAlerta,
} from '../services/notificaciones';
import { reportarUbicacion } from '../services/ubicacion';
import { navegar } from '../navigation/navigationRef';

/**
 * Lo mínimo entre dos informes de ubicación. La posición sirve para un radio
 * de kilómetros y el servidor la acepta hasta 72 h: informarla más seguido no
 * cambia a quién alcanza una alerta, y gasta batería y datos.
 *
 * Es también la defensa si algo vuelve a sacar y meter la app del primer plano
 * sin parar (ver abajo).
 */
const MINIMO_ENTRE_INFORMES_MS = 5 * 60_000;

/**
 * Deja la cuenta en condiciones de recibir alertas (fase 3).
 *
 * El servidor solo alcanza a quien cumple **las dos** condiciones: dispositivo
 * registrado y ubicación reciente. Aquí se atienden ambas.
 *
 * La ubicación se reenvía cuando la app vuelve al primer plano, no solo al
 * iniciar sesión: el servidor descarta las posiciones más viejas que su umbral
 * (72 h por defecto), así que una app que solo la enviara una vez dejaría de ser
 * alcanzable sin que nadie lo notara.
 *
 * **Los permisos se piden solo al entrar, nunca al volver al primer plano.** En
 * Android, pedir un permiso abre por un instante la pantalla de permisos del
 * sistema aunque ya esté concedido, y con ella la app sale del primer plano y
 * vuelve. Si esa vuelta lo pide otra vez, el ciclo no termina: pasó, con un
 * informe de ubicación por segundo, el GPS encendido y el mapa parpadeando.
 *
 * Ningún fallo aquí interrumpe el uso de la aplicación: quedan registrados en
 * consola para poder diagnosticarlos, pero no se le echan encima a la persona.
 */
export function useAlertas(isAuthenticated: boolean) {
  const yaRegistrado = useRef(false);
  // Cuándo empezó el último informe. Vuelve a cero al cerrar sesión: la cuenta
  // que entre después en este teléfono tiene que informar enseguida.
  const ultimoInforme = useRef(0);

  useEffect(() => {
    if (!isAuthenticated) {
      yaRegistrado.current = false;
      ultimoInforme.current = 0;
      return;
    }

    const poner = async (pedirPermisos: boolean) => {
      // Se cuenta desde que empieza y no desde que termina: así, una vuelta al
      // primer plano mientras este informe sigue en curso no lanza otro.
      const ahora = Date.now();
      if (ahora - ultimoInforme.current < MINIMO_ENTRE_INFORMES_MS) return;
      ultimoInforme.current = ahora;

      const ubicacion = await reportarUbicacion(pedirPermisos);
      if (!ubicacion.reportada) {
        console.warn(`No se reportó la ubicación: ${ubicacion.motivo}`);
      }

      // El registro del dispositivo se intenta una vez por sesión: el token no
      // cambia entre idas y venidas al primer plano.
      if (!yaRegistrado.current) {
        const push = await registrarDispositivoParaAlertas(pedirPermisos);
        yaRegistrado.current = push.registrado;
        if (!push.registrado) {
          console.warn(`Sin alertas push: ${push.motivo}`);
        }
      }
    };

    // Con `catch` y no suelto: una promesa rechazada sin atrapar aquí sale por
    // el manejador global y, en desarrollo, tapa la pantalla con la caja roja.
    // Nada de lo que hace `poner` justifica interrumpir el uso de la app.
    poner(true).catch((error) =>
      console.warn(`No se pudo preparar la recepción de alertas: ${error}`),
    );

    const suscripcionAppState = AppState.addEventListener(
      'change',
      (estado: AppStateStatus) => {
        if (estado === 'active') {
          poner(false).catch((error) =>
            console.warn(`No se pudo refrescar la ubicación: ${error}`),
          );
        }
      },
    );

    const dejarDeEscuchar = alTocarUnaAlerta(navegar);

    return () => {
      suscripcionAppState.remove();
      dejarDeEscuchar();
    };
  }, [isAuthenticated]);
}
