import React from 'react';
import MapView, { Circle, MapPressEvent, Marker } from 'react-native-maps';
import type { PropsMapa } from './tipos';

/**
 * Mapa con el SDK nativo de cada plataforma, a través de react-native-maps:
 * Apple Maps en iOS y Google Maps en Android.
 *
 * En iOS funciona sin clave de API y en Expo Go. En Android necesita la clave de
 * Google Maps dentro del APK; quien decide si se puede usar es `Mapa.android.tsx`.
 */
export const MapaNativo: React.FC<PropsMapa> = ({
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
    // Solo Android: al tocar un marcador, Google pone abajo a la derecha una
    // barra que abre su aplicación. Quedaría debajo del botón «Reportar».
    toolbarEnabled={false}
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
