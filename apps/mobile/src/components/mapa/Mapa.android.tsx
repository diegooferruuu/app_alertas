import React from 'react';
import MapaLeaflet from './MapaLeaflet';
import type { PropsMapa } from './tipos';

/**
 * Mapa en Android: Leaflet dentro de un componente DOM de Expo.
 *
 * **Aquí no se usa el SDK de Google**, y no por gusto. react-native-maps dibuja
 * en Android con él, y ese SDK no pinta nada —ni siquiera teselas propias— sin
 * una clave de API válida; conseguirla exige activar la facturación de Google
 * Cloud, que no pasó el cobro. Con una clave de relleno el mapa ya no se cerraba,
 * pero salía negro.
 *
 * Leaflet es la biblioteca libre de mapas web más usada. Corre en la webview que
 * Expo ya trae en el APK y en Expo Go (`@expo/dom-webview`), así que cambiar a
 * esto no pidió compilar de nuevo. Las calles son las mismas teselas de CARTO,
 * sin clave, y sin el logo de Google encima.
 *
 * La contrapartida es que va algo menos fluido que un mapa nativo. Para
 * producción, la alternativa nativa y libre sería MapLibre.
 */
export const Mapa: React.FC<PropsMapa> = ({ style, ...resto }) => (
  <MapaLeaflet
    {...resto}
    dom={{
      style: [{ flex: 1 }, style],
      // El mapa maneja sus propios gestos; que la página no se desplace.
      scrollEnabled: false,
      bounces: false,
      showsVerticalScrollIndicator: false,
      showsHorizontalScrollIndicator: false,
    }}
  />
);
