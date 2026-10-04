/**
 * Configuración dinámica: parte de `app.json` y solo añade la clave de Google
 * Maps, que no puede ir ahí.
 *
 * Todo lo demás vive en `app.json`, que es donde lo escriben las herramientas de
 * Expo (`eas init`, por ejemplo). Este archivo no lo repite.
 *
 * ## La clave de Google Maps
 *
 * En Android el mapa lo dibuja el SDK de Google, que lee la clave del manifiesto
 * nativo. **No se versiona**, porque el repositorio es público: es la variable
 * `GOOGLE_MAPS_API_KEY` de EAS (entornos development y preview), que solo existe
 * al compilar allí. En Google Cloud va restringida al paquete
 * `com.emergencyalert.app` con la huella SHA-1 del keystore de EAS, y a la API
 * «Maps SDK for Android».
 *
 * Sin la variable no se escribe ninguna clave. Pasa al compilar sin ella y cada
 * vez que Metro arranca en el Mac, que no la tiene ni la necesita: la clave va
 * al manifiesto, no al JavaScript. Por lo mismo, cambiarla exige recompilar.
 *
 * `extra.mapaDeGoogle` dice si el build lleva clave. El SDK de Google
 * **revienta** sin ella (`API key not found`), así que un APK que no la trae
 * dibuja el mapa de respaldo: ver `src/components/mapa/Mapa.android.tsx`.
 */
module.exports = ({ config }) => {
  const clave = process.env.GOOGLE_MAPS_API_KEY?.trim();

  return {
    ...config,
    android: clave
      ? {
          ...config.android,
          config: { ...config.android?.config, googleMaps: { apiKey: clave } },
        }
      : config.android,
    extra: {
      ...config.extra,
      // La clave no se puede consultar al ejecutar: Expo quita `android.config`
      // de la copia de esta configuración que guarda dentro del APK. Este
      // indicador sí queda. No se llama `mapaAndroid`, como el de septiembre, a
      // propósito: los APK de entonces lo traen en `true` con una clave de
      // relleno, y con ella el mapa de Google sale negro.
      mapaDeGoogle: Boolean(clave),
    },
  };
};
