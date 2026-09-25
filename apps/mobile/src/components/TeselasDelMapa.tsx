import React from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { UrlTile } from 'react-native-maps';
import { requireOptionalNativeModule } from 'expo';
import Constants from 'expo-constants';

/**
 * Teselas del mapa en Android.
 *
 * En iOS el mapa lo dibuja Apple Maps, funciona y no hace falta nada de aquí. En
 * Android lo dibuja el SDK de Google, y ahí dejó de cargar: se veía el marco,
 * los controles y el logo, pero ninguna calle. Sin una clave de API propia no
 * hay forma de arreglarlo desde el código —y en Expo Go ni siquiera eso serviría,
 * porque Expo Go va compilado con la suya y la de `app.json` solo entra en un
 * build propio—.
 *
 * La salida es no depender del SDK de Google para dibujar: con `mapType="none"`
 * —propio de Android— el mapa deja de pedirle la base a Google, y estas teselas,
 * que son imágenes por HTTP normales, la ponen.
 *
 * En el development build pasa lo mismo a propósito: lleva una clave de relleno
 * (ver `app.config.js`) solo para que el SDK arranque, Google la rechaza, y lo
 * que se ve son estas teselas.
 *
 * Contrapartida a declarar en el informe: el aspecto no es idéntico entre las
 * dos plataformas, y las teselas vienen de un servicio gratuito con cuota. Para
 * producción corresponde una clave de Google o una cuenta propia de teselas.
 */

/**
 * Servidor de teselas. `z/x/y` los sustituye el componente.
 *
 * **No se usa `tile.openstreetmap.org`**, aunque sea la fuente evidente. Sus
 * servidores los pagan voluntarios y su política exige que cada aplicación se
 * identifique con un `User-Agent` propio; a quien no lo hace le responden
 * **403 Access blocked**, y eso es exactamente lo que se veía en el mapa. No es
 * negociable desde aquí: `UrlTile` no expone ninguna forma de añadir cabeceras.
 *
 * CARTO sirve el mismo mapa —los datos siguen siendo de OpenStreetMap— desde
 * una red de distribución pensada para que la consuman aplicaciones, sin clave.
 * Para producción correspondería una cuenta propia con su cuota; para un
 * prototipo, este uso es el previsto.
 */
const PLANTILLA_TESELAS =
  'https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png';

/**
 * Niveles de acercamiento que sirve el proveedor. Por debajo de 3 no hay nada
 * útil y por encima de 19 responde error en vez de imagen.
 */
const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;

export const esAndroid = Platform.OS === 'android';

/**
 * La configuración con la que se compiló **este** APK.
 *
 * No sirve `Constants.expoConfig`: en un development build esa la manda Metro
 * en cada arranque, calculada en ese momento desde el `app.json` del Mac. Si el
 * Mac ya tiene clave pero el APK instalado es anterior, diría que hay mapa y el
 * mapa reventaría igual. Esta otra la escribe el propio build dentro del APK
 * —expo-constants la guarda como recurso— y solo cambia al instalar otro.
 */
function configuracionDelApk(): { extra?: { mapaAndroid?: unknown } } | null {
  const bruta = requireOptionalNativeModule<{ manifest?: unknown }>(
    'ExponentConstants',
  )?.manifest;
  if (!bruta) return null;
  try {
    // En Android llega como texto JSON; expo-constants la lee igual.
    return typeof bruta === 'string' ? JSON.parse(bruta) : (bruta as object);
  } catch {
    return null;
  }
}

/**
 * Si este build puede montar un mapa.
 *
 * En Android, un build propio sin clave de Google Maps **revienta** al crear el
 * mapa —`API key not found`—, y con él toda la pantalla. Aquí se decide antes de
 * montarlo, para mostrar un aviso en su lugar.
 *
 *  - iOS dibuja con Apple Maps: no necesita clave.
 *  - Expo Go trae la suya: siempre puede.
 *  - Un build propio en Android puede si se compiló con clave, real o de
 *    relleno (ver `app.config.js`). Lo dice `extra.mapaAndroid` del APK; el
 *    primer development build es anterior a ese indicador y no lo tiene.
 *
 * Si el indicador falta, se asume que no hay mapa: mostrar un aviso de más es
 * recuperable, reventar la pantalla no.
 */
export const mapaDisponible: boolean =
  !esAndroid ||
  Constants.executionEnvironment === 'storeClient' ||
  configuracionDelApk()?.extra?.mapaAndroid === true;

/**
 * En Android el mapa no debe pedirle la base a Google; en iOS sí la pide a
 * Apple, que funciona. Se exporta para que cada pantalla lo pase a su `MapView`.
 */
export const tipoDeMapa = esAndroid ? ('none' as const) : ('standard' as const);

/** Se pinta dentro del `MapView`; en iOS no devuelve nada. */
export const TeselasDelMapa: React.FC = () => {
  if (!esAndroid) return null;

  return (
    // Solo lo documentado como soportado en Android, y nada más.
    //
    // Llevaba también `tileCachePath="osm"` y `shouldReplaceMapContent`, y las
    // dos estaban mal: la primera quiere una ruta de directorio real o en
    // formato `file://` —un nombre suelto no lo es, y con una ruta inválida el
    // proveedor no llega a dibujar ninguna tesela—, y la segunda está marcada
    // «Android: Not supported» en la propia biblioteca. Guardar las imágenes en
    // disco habría estado bien para no regastar datos, pero no a cambio de que
    // el mapa no se vea.
    <UrlTile
      urlTemplate={PLANTILLA_TESELAS}
      minimumZ={ZOOM_MINIMO}
      maximumZ={ZOOM_MAXIMO}
    />
  );
};

/**
 * Atribución del mapa.
 *
 * No es cortesía: la licencia ODbL de los datos la exige, y los términos de
 * CARTO piden además nombrar el servicio. Se pinta **sobre** el mapa y no dentro
 * del `MapView`, cuyos hijos solo pueden ser elementos de mapa.
 *
 * En iOS no sale porque allí las teselas son de Apple, que pone su propio
 * distintivo.
 */
export const AtribucionDelMapa: React.FC = () => {
  if (!esAndroid) return null;
  return (
    <Text style={estilos.atribucion}>© OpenStreetMap · CARTO</Text>
  );
};

const estilos = StyleSheet.create({
  atribucion: {
    position: 'absolute',
    left: 6,
    bottom: 4,
    fontSize: 10,
    color: '#444',
    backgroundColor: 'rgba(255,255,255,0.75)',
    paddingHorizontal: 4,
    borderRadius: 3,
  },
});
