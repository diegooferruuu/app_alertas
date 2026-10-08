import React from 'react';
import type { PropsMapa } from './tipos';

export type { MarcadorMapa, PropsMapa, PuntoMapa, RegionMapa, ZonaMapa } from './tipos';

/**
 * Declaración de tipo para que TypeScript resuelva el import.
 * En ejecución, Metro elige `Mapa.ios.tsx` (Apple Maps) o `Mapa.android.tsx`
 * (Google Maps, o Leaflet si el APK no trae clave). La web no tiene mapa.
 */
export declare const Mapa: React.FC<PropsMapa>;
