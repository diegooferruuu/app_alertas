#!/usr/bin/env node
/**
 * La zona del caso para la prueba de campo, y dónde poner cada teléfono.
 *
 *   node tools/campo/zona.mjs <lat> <lng>                  el punto que se va a marcar
 *   node tools/campo/zona.mjs <lat> <lng> <lat,lng> ...    y la distancia de otros puntos
 *
 * El servidor no guarda el punto que se marca en el mapa: lo lleva al centro de
 * su celda de 0,01° (`apps/backend/src/denuncias/domain/zona-avistamiento.ts`),
 * y la consulta de destinatarios mide la distancia desde ese centro. Por eso los
 * teléfonos se ubican respecto del centro, no del punto marcado. Cualquier punto
 * de la misma celda da el mismo centro: al marcar, basta con caer dentro.
 *
 * Sin dependencias: solo Node.
 */

const PASO_REJILLA = 0.01;
const RADIO_M = 2_000; // vínculo familiar (`radioProvisionalM`)
const DENTRO_M = 1_000;
const FUERA_M = 3_500;

/**
 * Copia de `aCentroDeCelda`. Si cambia allá, cambia aquí: el centro tiene que
 * salir idéntico, hasta el último decimal.
 */
const aCentroDeCelda = (valor) => {
  const celda = Math.floor(valor / PASO_REJILLA);
  return Number(((celda + 0.5) * PASO_REJILLA).toFixed(7));
};

const RAD = Math.PI / 180;

/**
 * Distancia geodésica sobre el elipsoide WGS84 (Vincenty), en metros.
 *
 * Es la misma que calcula PostGIS con `ST_Distance` sobre `geography`, que es
 * la que decide quién recibe la alerta. Con una esfera el error llegaría a unos
 * 10 m en 2 km, que en el borde del radio importa.
 */
function distancia(lat1, lon1, lat2, lon2) {
  const a = 6_378_137;
  const f = 1 / 298.257223563;
  const b = a * (1 - f);
  const L = (lon2 - lon1) * RAD;
  const U1 = Math.atan((1 - f) * Math.tan(lat1 * RAD));
  const U2 = Math.atan((1 - f) * Math.tan(lat2 * RAD));
  const sinU1 = Math.sin(U1), cosU1 = Math.cos(U1);
  const sinU2 = Math.sin(U2), cosU2 = Math.cos(U2);

  let lambda = L;
  let sinSigma, cosSigma, sigma, cos2Alfa, cos2SigmaM;
  for (let i = 0; i < 200; i++) {
    const sinLambda = Math.sin(lambda), cosLambda = Math.cos(lambda);
    sinSigma = Math.hypot(cosU2 * sinLambda, cosU1 * sinU2 - sinU1 * cosU2 * cosLambda);
    if (sinSigma === 0) return 0;
    cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosLambda;
    sigma = Math.atan2(sinSigma, cosSigma);
    const sinAlfa = (cosU1 * cosU2 * sinLambda) / sinSigma;
    cos2Alfa = 1 - sinAlfa * sinAlfa;
    cos2SigmaM = cos2Alfa === 0 ? 0 : cosSigma - (2 * sinU1 * sinU2) / cos2Alfa;
    const C = (f / 16) * cos2Alfa * (4 + f * (4 - 3 * cos2Alfa));
    const anterior = lambda;
    lambda =
      L +
      (1 - C) * f * sinAlfa *
        (sigma + C * sinSigma * (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM ** 2)));
    if (Math.abs(lambda - anterior) < 1e-12) break;
  }
  const u2 = (cos2Alfa * (a * a - b * b)) / (b * b);
  const A = 1 + (u2 / 16384) * (4096 + u2 * (-768 + u2 * (320 - 175 * u2)));
  const B = (u2 / 1024) * (256 + u2 * (-128 + u2 * (74 - 47 * u2)));
  const deltaSigma =
    B * sinSigma *
    (cos2SigmaM +
      (B / 4) *
        (cosSigma * (-1 + 2 * cos2SigmaM ** 2) -
          (B / 6) * cos2SigmaM * (-3 + 4 * sinSigma ** 2) * (-3 + 4 * cos2SigmaM ** 2)));
  return b * A * (sigma - deltaSigma);
}

/** El punto a tantos metros en un rumbo. Esférico: solo sirve para sugerir. */
function destino(lat, lon, rumbo, metros) {
  const d = metros / 6_371_008.8;
  const t = rumbo * RAD;
  const p1 = lat * RAD;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(t));
  const l2 =
    lon * RAD +
    Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / RAD, l2 / RAD];
}

const leerPunto = (texto) => {
  const partes = String(texto).split(',').map(Number);
  return partes.length === 2 && partes.every(Number.isFinite) ? partes : null;
};

const coord = (lat, lng) => `${lat.toFixed(6)},${lng.toFixed(6)}`;
const mapa = (lat, lng) => `https://maps.google.com/?q=${coord(lat, lng)}`;
const km = (m) => `${(m / 1000).toFixed(2).replace('.', ',')} km`;

function posicion(m) {
  if (m < DENTRO_M) return 'DENTRO (a menos de 1 km)';
  if (m > FUERA_M) return 'FUERA (a más de 3,5 km)';
  return m <= RADIO_M
    ? 'BORDE: recibiría la alerta, pero sin margen. Acércalo a menos de 1 km'
    : 'BORDE: no la recibiría, pero sin margen. Aléjalo a más de 3,5 km';
}

const [latTexto, lngTexto, ...otros] = process.argv.slice(2);
const lat = Number(latTexto);
const lng = Number(lngTexto);
if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
  console.error('Uso: node tools/campo/zona.mjs <lat> <lng> [<lat,lng> ...]');
  console.error('Ejemplo: node tools/campo/zona.mjs -17.3935 -66.1570 -17.3990,-66.1570');
  process.exit(2);
}

const centro = { lat: aCentroDeCelda(lat), lng: aCentroDeCelda(lng) };
const sur = Math.floor(lat / PASO_REJILLA) * PASO_REJILLA;
const oeste = Math.floor(lng / PASO_REJILLA) * PASO_REJILLA;
const norte = sur + PASO_REJILLA;
const este = oeste + PASO_REJILLA;

const altoCelda = distancia(sur, centro.lng, norte, centro.lng);
const anchoCelda = distancia(centro.lat, oeste, centro.lat, este);
const aLosBordes = Math.min(
  distancia(lat, lng, sur, lng),
  distancia(lat, lng, norte, lng),
  distancia(lat, lng, lat, oeste),
  distancia(lat, lng, lat, este),
);

console.log('ZONA DEL CASO');
console.log(`  Punto que vas a marcar:  ${coord(lat, lng)}`);
console.log(`  Centro de la zona:       ${coord(centro.lat, centro.lng)}   ← desde aquí se mide`);
console.log(`                           ${mapa(centro.lat, centro.lng)}`);
console.log(`  Del punto al centro:     ${Math.round(distancia(lat, lng, centro.lat, centro.lng))} m`);
console.log(
  `  Celda:                   latitud de ${sur.toFixed(2)} a ${norte.toFixed(2)}, ` +
    `longitud de ${oeste.toFixed(2)} a ${este.toFixed(2)}`,
);
console.log(`                           ${Math.round(altoCelda)} m de norte a sur × ${Math.round(anchoCelda)} m de este a oeste`);
console.log(
  `  Al marcar en la app:     cualquier punto con latitud entre ${sur.toFixed(2)} y ${norte.toFixed(2)} ` +
    `y longitud entre ${oeste.toFixed(2)} y ${este.toFixed(2)} da este mismo centro.`,
);
console.log('                           La app muestra el punto elegido con 4 decimales: compruébalo ahí.');
if (aLosBordes < 150) {
  console.log(
    `  ⚠ El punto está a ${Math.round(aLosBordes)} m del borde de su celda: un toque un poco ` +
      'corrido en el mapa cae en otra celda y cambia el centro. Marca el centro de la zona.',
  );
}

const RUMBOS = [
  ['norte', 0], ['noreste', 45], ['este', 90], ['sureste', 135],
  ['sur', 180], ['suroeste', 225], ['oeste', 270], ['noroeste', 315],
];

const sugerir = (titulo, metros, rumbos) => {
  console.log(`\n${titulo}`);
  for (const m of metros) {
    for (const [nombre, grados] of rumbos) {
      const [pLat, pLng] = destino(centro.lat, centro.lng, grados, m);
      const real = distancia(centro.lat, centro.lng, pLat, pLng);
      console.log(`  ${km(real).padStart(8)} al ${nombre.padEnd(9)} ${coord(pLat, pLng)}   ${mapa(pLat, pLng)}`);
    }
  }
};

sugerir(
  `EJEMPLOS DENTRO (a menos de 1 km del centro; el radio es de ${RADIO_M / 1000} km)`,
  [400, 800],
  RUMBOS.filter((_, i) => i % 2 === 0),
);
sugerir('EJEMPLOS FUERA (a más de 3,5 km del centro)', [4_000, 5_000], RUMBOS);

console.log(
  '\nSon puntos en línea recta: elige en el mapa un lugar público y accesible cerca de cada uno,\n' +
    'y comprueba su distancia pasándolo como argumento. Dentro de un edificio el GPS puede\n' +
    'errar unos cientos de metros: por eso los márgenes de 1 km y de 3,5 km.',
);

if (otros.length > 0) {
  console.log('\nDISTANCIA AL CENTRO');
  for (const texto of otros) {
    const p = leerPunto(texto);
    if (!p) {
      console.log(`  ${texto}: no es un punto. Escríbelo como lat,lng sin espacios.`);
      continue;
    }
    const m = distancia(centro.lat, centro.lng, p[0], p[1]);
    console.log(`  ${coord(p[0], p[1])}   ${km(m).padStart(8)}   ${posicion(m)}`);
  }
}
