/**
 * Punto al que se centra el mapa cuando todavía no hay nada mejor.
 *
 * Se usa mientras se resuelve el permiso de ubicación, cuando se deniega, y
 * como centro del selector al reportar. **No es la ubicación de nadie**: es solo
 * a dónde mirar para no abrir el mapa sobre el océano.
 *
 * Estaba escrito a mano en cuatro archivos —dos pantallas de mapa, la lista y el
 * selector— con el nombre `LA_PAZ`. Cambiar de ciudad obligaba a encontrarlos
 * todos, y bastaba olvidar uno para que una pantalla abriera en otro
 * departamento sin que nada fallara.
 */
export const CENTRO_POR_DEFECTO = {
  latitude: -17.38187981896557,
  longitude: -66.15198734651142,
};

/** La misma coordenada con los nombres cortos que usan algunas pantallas. */
export const CENTRO_POR_DEFECTO_CORTO = {
  lat: CENTRO_POR_DEFECTO.latitude,
  lng: CENTRO_POR_DEFECTO.longitude,
};

/**
 * Amplitud inicial del mapa, en grados.
 *
 * 0,05° son unos 5 km: se ve el barrio y sus alrededores, que es la escala a la
 * que tiene sentido una alerta de zona.
 */
export const AMPLITUD_INICIAL = 0.05;
