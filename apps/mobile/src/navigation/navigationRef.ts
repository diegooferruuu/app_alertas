import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Referencia al navegador para actuar desde fuera del árbol de React.
 *
 * Hace falta porque una notificación puede tocarse con la app cerrada o en
 * segundo plano: quien reacciona no es una pantalla montada, es un escuchador.
 */
export const navigationRef = createNavigationContainerRef();

export function navegar(pantalla: string, params?: Record<string, unknown>) {
  if (navigationRef.isReady()) {
    // @ts-expect-error las rutas no están tipadas en este proyecto
    navigationRef.navigate(pantalla, params);
  }
}
