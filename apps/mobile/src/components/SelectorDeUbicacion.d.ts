import React from 'react';

export interface Coordenadas {
  lat: number;
  lng: number;
}

/**
 * Declaración de tipo para que TypeScript resuelva el import.
 * En ejecución, Metro elige `.native.tsx` (iOS/Android) o `.web.tsx`.
 */
export declare const SelectorDeUbicacion: React.FC<{
  valor: Coordenadas | null;
  onChange: (coords: Coordenadas) => void;
}>;
