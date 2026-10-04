/**
 * Lo que la configuración guardada dentro del APK dice del mapa.
 *
 * Va aparte de `Mapa.android.tsx`, sin React Native ni Expo, para poder
 * probarlo en Node.
 */

type ConfiguracionEmbebida = { extra?: { mapaDeGoogle?: unknown } } | null | undefined;

/**
 * Si el APK se compiló con clave de Google Maps (ver `app.config.js`).
 *
 * `bruta` es la configuración tal como la entrega expo-constants: en Android,
 * texto JSON. Ante cualquier duda responde que no: el mapa de Google revienta
 * sin clave, y el de respaldo no necesita ninguna.
 */
export const traeMapaDeGoogle = (bruta: unknown): boolean => {
  try {
    const configuracion = (
      typeof bruta === 'string' ? JSON.parse(bruta) : bruta
    ) as ConfiguracionEmbebida;
    return configuracion?.extra?.mapaDeGoogle === true;
  } catch {
    return false;
  }
};
