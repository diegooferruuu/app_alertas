import React from 'react';
import MapView, { Circle, MapPressEvent, Marker } from 'react-native-maps';
import type { PropsMapa } from './tipos';

/**
 * Mapa en iOS: Apple Maps, a través de react-native-maps.
 *
 * Funciona sin clave de API y en Expo Go, así que aquí no hay nada que sustituir.
 * Android dibuja con Leaflet (ver `Mapa.android.tsx`).
 */
export const Mapa: React.FC<PropsMapa> = ({
  region,
  marcadores = [],
  zona,
  ubicacionUsuario,
  alTocar,
  style,
}) => (
  <MapView
    style={style}
    region={region}
    showsUserLocation={!!ubicacionUsuario}
    onPress={
      alTocar
        ? (e: MapPressEvent) => {
            const { latitude, longitude } = e.nativeEvent.coordinate;
            alTocar({ lat: latitude, lng: longitude });
          }
        : undefined
    }
  >
    {marcadores.map((m) => (
      <Marker
        key={m.id}
        coordinate={{ latitude: m.lat, longitude: m.lng }}
        title={m.titulo}
        description={m.detalle}
        pinColor={m.color}
      />
    ))}
    {zona && (
      <Circle
        center={{ latitude: zona.lat, longitude: zona.lng }}
        radius={zona.radioM}
        strokeColor="rgba(0,122,255,0.8)"
        fillColor="rgba(0,122,255,0.15)"
      />
    )}
  </MapView>
);
