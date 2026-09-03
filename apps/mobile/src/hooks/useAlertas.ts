import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  registrarDispositivoParaAlertas,
  alTocarUnaAlerta,
} from '../services/notificaciones';
import { reportarUbicacion } from '../services/ubicacion';
import { navegar } from '../navigation/navigationRef';

/**
 * Deja la cuenta en condiciones de recibir alertas (fase 3).
 *
 * El servidor solo alcanza a quien cumple **las dos** condiciones: dispositivo
 * registrado y ubicación reciente. Aquí se atienden ambas.
 *
 * La ubicación se reenvía cada vez que la app vuelve al primer plano, no solo al
 * iniciar sesión: el servidor descarta las posiciones más viejas que su umbral
 * (72 h por defecto), así que una app que solo la enviara una vez dejaría de ser
 * alcanzable sin que nadie lo notara.
 *
 * Ningún fallo aquí interrumpe el uso de la aplicación: quedan registrados en
 * consola para poder diagnosticarlos, pero no se le echan encima a la persona.
 */
export function useAlertas(isAuthenticated: boolean) {
  const yaRegistrado = useRef(false);

  useEffect(() => {
    if (!isAuthenticated) {
      yaRegistrado.current = false;
      return;
    }

    const poner = async () => {
      const ubicacion = await reportarUbicacion();
      if (!ubicacion.reportada) {
        console.warn(`No se reportó la ubicación: ${ubicacion.motivo}`);
      }

      // El registro del dispositivo se intenta una vez por sesión: el token no
      // cambia entre idas y venidas al primer plano.
      if (!yaRegistrado.current) {
        const push = await registrarDispositivoParaAlertas();
        yaRegistrado.current = push.registrado;
        if (!push.registrado) {
          console.warn(`Sin alertas push: ${push.motivo}`);
        }
      }
    };

    poner();

    const suscripcionAppState = AppState.addEventListener(
      'change',
      (estado: AppStateStatus) => {
        if (estado === 'active') poner();
      },
    );

    const dejarDeEscuchar = alTocarUnaAlerta(navegar);

    return () => {
      suscripcionAppState.remove();
      dejarDeEscuchar();
    };
  }, [isAuthenticated]);
}
