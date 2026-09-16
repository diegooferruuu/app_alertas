/**
 * Reducción de la precisión del último avistamiento.
 *
 * Es un invariante del proyecto, no una mejora: **la ubicación exacta de un
 * avistamiento no debe existir en la base de datos.** No se trata de ocultarla
 * en las respuestas —eso sería confiar en que ninguna consulta futura la
 * exponga—, sino de que el dato preciso nunca llegue a escribirse.
 *
 * La razón es directa. El punto de un avistamiento suele ser el domicilio, el
 * colegio o el lugar de trabajo de una persona desaparecida, y a menudo también
 * el de quien denuncia. Guardarlo con precisión de metros construye un registro
 * de direcciones de personas en situación vulnerable, que es exactamente la
 * clase de base de datos que este sistema existe para no crear.
 *
 * Pasó a ser urgente al añadir el selector de mapa: mientras la ubicación salía
 * del GPS del teléfono ya era imprecisa por accidente, pero eligiendo en un mapa
 * cualquiera puede marcar un portón concreto.
 */

/**
 * Lado aproximado de la celda, en grados de latitud.
 *
 * Un grado de latitud son unos 111 km en cualquier punto del planeta, así que
 * 0,01 grados son ~1,1 km. Se redondea a una rejilla de ese paso: todos los
 * puntos de una misma celda producen las mismas coordenadas.
 *
 * ~1 km es el tamaño que la especificación del proyecto fijó para la zona de
 * avistamiento. Encaja además con cómo se difunde: el radio menor es de 1 km, de
 * modo que la reducción no altera a quién alcanza la alerta.
 */
export const PASO_REJILLA = 0.01;

/**
 * Lleva un punto al centro de su celda.
 *
 * Se devuelve el centro y no la esquina para que el punto guardado quede a lo
 * sumo a media celda del real en cada eje, en vez de hasta una celda entera. Y
 * se fija la precisión decimal porque estos valores entran en el hash del
 * contenido de la denuncia: el mismo punto tiene que producir siempre la misma
 * cadena.
 */
export const aCentroDeCelda = (valor: number): number => {
  const celda = Math.floor(valor / PASO_REJILLA);
  return Number(((celda + 0.5) * PASO_REJILLA).toFixed(7));
};

export interface Punto {
  latitude: number;
  longitude: number;
}

/**
 * Reduce un punto a la zona de ~1 km que lo contiene.
 *
 * La longitud se redondea con el mismo paso que la latitud. En un grado de
 * longitud la distancia real se encoge al alejarse del ecuador: en Bolivia
 * —entre los paralelos 9 y 23 sur— una celda mide entre 1,0 y 1,1 km de ancho.
 * Usar el mismo paso mantiene la rejilla regular en coordenadas, que es lo que
 * hace que la reducción sea reproducible y verificable desde una constancia.
 */
export const aZonaDeAvistamiento = (punto: Punto): Punto => ({
  latitude: aCentroDeCelda(punto.latitude),
  longitude: aCentroDeCelda(punto.longitude),
});

/** Un punto está reducido si reducirlo otra vez no lo cambia. */
export const estaReducido = (punto: Punto): boolean => {
  const zona = aZonaDeAvistamiento(punto);
  return (
    zona.latitude === punto.latitude && zona.longitude === punto.longitude
  );
};
