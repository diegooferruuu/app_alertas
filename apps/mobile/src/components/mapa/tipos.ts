import type { StyleProp, ViewStyle } from 'react-native';

export interface PuntoMapa {
  lat: number;
  lng: number;
}

/** Qué parte del mapa se muestra. Misma forma que la región de react-native-maps. */
export interface RegionMapa {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MarcadorMapa {
  id: string;
  lat: number;
  lng: number;
  titulo: string;
  detalle?: string;
  color: string;
}

/** Círculo de una zona, con el radio en metros. */
export interface ZonaMapa {
  lat: number;
  lng: number;
  radioM: number;
}

export interface PropsMapa {
  /**
   * Encuadre. El mapa se mueve cuando cambia su valor, no en cada render: así
   * no salta de vuelta mientras la persona lo recorre.
   */
  region: RegionMapa;
  marcadores?: MarcadorMapa[];
  zona?: ZonaMapa | null;
  /** Si se pasa, se marca dónde está quien mira el mapa. */
  ubicacionUsuario?: PuntoMapa | null;
  alTocar?: (punto: PuntoMapa) => void;
  /**
   * Al tocar el recuadro que aparece sobre un marcador, con el `id` de ese
   * marcador. Sin esto, el recuadro solo informa.
   */
  alAbrirMarcador?: (id: string) => void;
  style?: StyleProp<ViewStyle>;
}
