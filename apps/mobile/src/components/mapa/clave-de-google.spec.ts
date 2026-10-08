import { afterEach, describe, expect, it } from '@jest/globals';
import { traeMapaDeGoogle } from './configuracion-del-apk';

// `app.config.js` es JavaScript que Expo carga tal cual: se prueba igual.
const configuracionDeExpo: (entrada: { config: any }) => any = require('../../../app.config.js');
const { expo: appJson } = require('../../../app.json');

const CLAVE = 'clave-de-prueba';
const variableOriginal = process.env.GOOGLE_MAPS_API_KEY;

const resolver = (clave: string | undefined) => {
  if (clave === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = clave;
  // Copia: que una prueba no toque el app.json de las demás.
  return configuracionDeExpo({ config: structuredClone(appJson) });
};

/** Lo que expo-constants guarda en el APK: texto JSON, sin `android.config`. */
const copiaEmbebida = (config: any): string => {
  const copia = structuredClone(config);
  delete copia.android?.config;
  return JSON.stringify(copia);
};

afterEach(() => {
  if (variableOriginal === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
  else process.env.GOOGLE_MAPS_API_KEY = variableOriginal;
});

describe('clave de Google Maps, de EAS al mapa', () => {
  it('con la variable, la clave va al manifiesto y el APK dice que puede usar Google', () => {
    const config = resolver(CLAVE);

    expect(config.android.config.googleMaps.apiKey).toBe(CLAVE);
    expect(traeMapaDeGoogle(copiaEmbebida(config))).toBe(true);
  });

  it('sin la variable no se escribe clave y el APK usa el mapa de respaldo', () => {
    // Así arranca Metro en el Mac, y así compilaría EAS si la variable faltara.
    for (const clave of [undefined, '', '   ']) {
      const config = resolver(clave);

      expect(config.android.config?.googleMaps).toBeUndefined();
      expect(config.extra.mapaDeGoogle).toBe(false);
      expect(traeMapaDeGoogle(copiaEmbebida(config))).toBe(false);
    }
  });

  it('conserva lo que viene de app.json', () => {
    const config = resolver(CLAVE);

    expect(config.android.package).toBe('com.emergencyalert.app');
    expect(config.extra.eas.projectId).toBe(appJson.extra.eas.projectId);
    expect(config.plugins).toEqual(appJson.plugins);
  });
});

describe('traeMapaDeGoogle', () => {
  it('el indicador de septiembre no cuenta: esos APK traen una clave de relleno', () => {
    expect(traeMapaDeGoogle(JSON.stringify({ extra: { mapaAndroid: true } }))).toBe(false);
  });

  it('ante una configuración ilegible o ausente, responde que no', () => {
    for (const bruta of [undefined, null, '', 'no es JSON', '{"extra":{"mapaDeGoogle":"true"}}']) {
      expect(traeMapaDeGoogle(bruta)).toBe(false);
    }
  });

  it('también la lee si llega como objeto', () => {
    expect(traeMapaDeGoogle({ extra: { mapaDeGoogle: true } })).toBe(true);
  });
});
