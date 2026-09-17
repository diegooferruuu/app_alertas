import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { UrlTile } from 'react-native-maps';

/**
 * Teselas del mapa en Android.
 *
 * En iOS el mapa lo dibuja Apple Maps y no hace falta nada. En Android lo dibuja
 * el SDK de Google, que **exige una clave de API**: sin ella se ve el marco, los
 * controles y el logo, pero ninguna calle. Es exactamente ese síntoma, y no un
 * fallo de red.
 *
 * La clave no se puede arreglar desde aquí mientras se use Expo Go: Expo Go es
 * una aplicación ya compilada con la suya, y la que pongas en `app.json` solo
 * entra en un dev build. Así que en Expo Go no hay forma de que Google dibuje.
 *
 * OpenStreetMap sí: son imágenes por HTTP, sin clave y sin SDK de por medio.
 * Con `mapType="none"` —que es propio de Android— el mapa deja de pedirle nada a
 * Google y se dibuja solo con estas teselas.
 *
 * Contrapartida a declarar: el aspecto no es idéntico entre plataformas, y la
 * política de uso de OSM pide atribución visible y desaconseja el tráfico
 * intenso. Para un prototipo es adecuado; para producción, o se contrata la
 * clave de Google o se paga un proveedor de teselas.
 */

/** Servidor de teselas de OpenStreetMap. `z/x/y` los sustituye el componente. */
const PLANTILLA_OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Niveles de acercamiento que sirve OSM. Por debajo de 3 no hay nada útil y por
 * encima de 19 el servidor devuelve error en vez de imagen.
 */
const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;

export const esAndroid = Platform.OS === 'android';

/**
 * En Android el mapa no debe pedirle la base a Google; en iOS sí la pide a
 * Apple, que funciona. Se exporta para que cada pantalla lo pase a su `MapView`.
 */
export const tipoDeMapa = esAndroid ? ('none' as const) : ('standard' as const);

/** Se pinta dentro del `MapView`; en iOS no devuelve nada. */
export const TeselasDelMapa: React.FC = () => {
  if (!esAndroid) return null;

  return (
    <UrlTile
      urlTemplate={PLANTILLA_OSM}
      minimumZ={ZOOM_MINIMO}
      maximumZ={ZOOM_MAXIMO}
      // Sin esto las teselas se dibujan encima de los marcadores y el pin de la
      // denuncia queda tapado por el propio mapa.
      zIndex={-1}
      // Deja las imágenes en disco: al volver a la misma zona no se vuelven a
      // descargar, que en una conexión de datos compartida se nota.
      shouldReplaceMapContent
      tileCachePath="osm"
    />
  );
};

/**
 * Atribución de OpenStreetMap.
 *
 * No es cortesía: la política de uso de las teselas la exige, igual que la
 * licencia ODbL de los datos. Se pinta **sobre** el mapa y no dentro del
 * `MapView`, cuyos hijos solo pueden ser elementos de mapa.
 *
 * En iOS no sale porque allí las teselas son de Apple, que pone su propio
 * distintivo.
 */
export const AtribucionOSM: React.FC = () => {
  if (!esAndroid) return null;
  return <Text style={estilos.atribucion}>© OpenStreetMap</Text>;
};

const estilos = StyleSheet.create({
  atribucion: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    fontSize: 10,
    color: '#444',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
