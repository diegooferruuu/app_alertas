/**
 * Configuración dinámica: parte de `app.json` y solo añade lo que no puede ir ahí.
 *
 * Todo lo demás sigue viviendo en `app.json`, que es donde lo escriben las
 * herramientas de Expo (`eas init`, por ejemplo). Este archivo no lo repite.
 *
 * ## La clave de Google Maps en Android
 *
 * En Android el mapa lo dibuja el SDK de Google, y en un build propio **revienta
 * al crearse** si el manifiesto no trae *alguna* clave: no deja un mapa gris,
 * cierra la pantalla con `IllegalStateException: API key not found`. En Expo Go
 * no pasa porque Expo Go trae la suya.
 *
 * Una clave real exige activar la facturación de Google Cloud. Mientras no la
 * haya, va una **de relleno**: con ella el SDK arranca, Google la rechaza y su
 * base no carga —queda gris—, pero las calles no dependen de ella: las dibujan
 * encima las teselas de CARTO (ver `TeselasDelMapa`). Es lo mismo que ya se ve en
 * Expo Go.
 *
 * Es un apaño de prototipo, no de producción: el SDK de Google está pensado para
 * usarse con una clave válida, y sus términos no admiten mezclarlo con mapas de
 * otro proveedor. En producción corresponde una clave real o una biblioteca de
 * mapas libre, como MapLibre.
 *
 * Una clave real se pone en `app.json`, en `android.config.googleMaps.apiKey`, y
 * gana sobre la de relleno. Hace falta recompilar: la clave va al manifiesto
 * nativo, no al JavaScript.
 */
const CLAVE_DE_RELLENO = 'sin-clave-las-calles-las-dibuja-carto';

module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    config: {
      ...config.android?.config,
      googleMaps: {
        apiKey: config.android?.config?.googleMaps?.apiKey || CLAVE_DE_RELLENO,
      },
    },
  },
  extra: {
    ...config.extra,
    // Todo APK compilado desde aquí lleva alguna clave, así que puede montar el
    // mapa. Quien lo lee no es esta configuración sino la copia que queda dentro
    // del APK: ver `mapaDisponible` en `TeselasDelMapa`.
    mapaAndroid: true,
  },
});
