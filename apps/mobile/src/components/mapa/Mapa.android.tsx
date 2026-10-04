import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { requireOptionalNativeModule } from 'expo';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapaLeaflet from './MapaLeaflet';
import { MapaNativo, type PropsMapaNativo } from './MapaNativo';
import { traeMapaDeGoogle } from './configuracion-del-apk';
import type { PropsMapa, RegionMapa } from './tipos';

/**
 * Mapa en Android: Google Maps si este APK trae clave, y Leaflet si no.
 *
 * El SDK de Google **revienta** al crear el mapa si el manifiesto no trae clave
 * (`API key not found`), y con una clave inválida sale negro. La clave entra al
 * compilar en EAS (ver `app.config.js`), así que hay APK con ella y sin ella:
 * los anteriores a octubre de 2026, y cualquiera compilado sin la variable. Para
 * esos queda Leaflet, que no necesita clave.
 *
 * Expo Go trae su propia clave de Google: ahí siempre se usa Google.
 */

/**
 * La configuración con la que se compiló **este** APK, tal como la guarda
 * expo-constants dentro de él.
 *
 * No sirve `Constants.expoConfig`: en un development build esa la manda Metro en
 * cada arranque, calculada en el Mac, que no tiene la clave. Esta otra solo
 * cambia al instalar otro APK.
 */
const configuracionDelApk = (): unknown =>
  requireOptionalNativeModule<{ manifest?: unknown }>('ExponentConstants')?.manifest;

const conGoogle =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  traeMapaDeGoogle(configuracionDelApk());

/**
 * Google Maps, montado solo mientras su pantalla tiene el foco.
 *
 * Esquiva un fallo de react-native-maps en Android (issue #6015, abierto y sin
 * versión que lo corrija al 2026-10-04; afecta a la 1.27.2 de aquí y a la
 * 1.29.11). Al cambiar de pestaña, Android desconecta el mapa, lo vuelve a
 * conectar y lo desconecta otra vez en unos 40 ms. La biblioteca guarda los
 * marcadores en la primera desconexión para reponerlos al volver, y la segunda
 * pisa lo guardado con una lista vacía: al regresar, el mapa salía sin ninguna
 * denuncia. Pasa igual al volver del detalle de una denuncia.
 *
 * Desmontado, ese vaivén no tiene nada que perder, y al volver se crea un mapa
 * nuevo con todos sus marcadores. Para que no salte de vuelta a la ubicación de
 * la persona, aparece donde había quedado la cámara.
 */
const MapaGoogle: React.FC<PropsMapa> = (props) => {
  const enfocada = useIsFocused();
  // Dónde quedó la cámara. Sobrevive de un montaje al siguiente porque lo que
  // se desmonta al perder el foco es el hijo, no este componente.
  const camara = useRef<RegionMapa | null>(null);

  // Si la pantalla pide otro encuadre, ese manda sobre donde quedó la cámara.
  const { latitude, longitude, latitudeDelta, longitudeDelta } = props.region;
  useEffect(() => {
    camara.current = null;
  }, [latitude, longitude, latitudeDelta, longitudeDelta]);

  if (!enfocada) return <View style={[estilos.contenedor, estilos.fondo, props.style]} />;
  return (
    <MapaGoogleMontado
      {...props}
      desde={camara.current}
      alMoverse={(r) => {
        camara.current = r;
      }}
    />
  );
};

/**
 * Un montaje del mapa de Google.
 *
 * El encuadre se fija al montar y solo cambia si la pantalla pide otro. Pasarle
 * la cámara en cada render lo haría saltar al último punto en que se detuvo
 * cuando la pantalla se redibuja mientras alguien lo arrastra.
 */
const MapaGoogleMontado: React.FC<PropsMapaNativo & { desde: RegionMapa | null }> = ({
  desde,
  region,
  ...resto
}) => {
  const [encuadre, setEncuadre] = useState<RegionMapa>(desde ?? region);
  const pedida = useRef(region);

  useEffect(() => {
    const anterior = pedida.current;
    if (
      anterior.latitude === region.latitude &&
      anterior.longitude === region.longitude &&
      anterior.latitudeDelta === region.latitudeDelta &&
      anterior.longitudeDelta === region.longitudeDelta
    ) {
      return;
    }
    pedida.current = region;
    setEncuadre(region);
  }, [region.latitude, region.longitude, region.latitudeDelta, region.longitudeDelta]);

  return <MapaNativo {...resto} region={encuadre} />;
};

/**
 * Cuánto se espera a que la página del mapa avise que arrancó. La primera vez,
 * en desarrollo, Metro tiene que armar su bundle web: puede tardar.
 */
const ESPERA_MS = 20_000;

/**
 * Mapa de respaldo: Leaflet dentro de un componente DOM de Expo.
 *
 * Corre en la webview que Expo ya trae en el APK (`@expo/dom-webview`), así que
 * no depende de nada que haya que compilar. Las calles son teselas de
 * OpenStreetMap; el detalle de cuándo las sirve está en `MapaLeaflet.tsx`.
 *
 * La página del mapa avisa cuando arranca. Si no avisa a tiempo, se dice aquí
 * en vez de dejar un recuadro en blanco: en un teléfono real ese fue justo el
 * síntoma, sin ninguna pista de la causa.
 */
const MapaDeRespaldo: React.FC<PropsMapa> = ({ style, ...resto }) => {
  const [estado, setEstado] = useState<'cargando' | 'listo' | 'fallo'>('cargando');
  const [motivo, setMotivo] = useState<string | null>(null);
  // Cambiarlo vuelve a montar la página del mapa desde cero.
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    setEstado('cargando');
    setMotivo(null);
    const espera = setTimeout(
      () => setEstado((actual) => (actual === 'cargando' ? 'fallo' : actual)),
      ESPERA_MS,
    );
    return () => clearTimeout(espera);
  }, [intento]);

  return (
    <View style={[estilos.contenedor, style]}>
      <MapaLeaflet
        key={intento}
        {...resto}
        alListo={() => setEstado('listo')}
        alFallar={(m: string) => {
          setMotivo(m);
          setEstado('fallo');
        }}
        dom={{
          style: { flex: 1 },
          // El mapa maneja sus propios gestos; que la página no se desplace.
          scrollEnabled: false,
          bounces: false,
          showsVerticalScrollIndicator: false,
          showsHorizontalScrollIndicator: false,
        }}
      />

      {estado === 'cargando' && (
        <View style={estilos.aviso} pointerEvents="none">
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={estilos.avisoTexto}>Cargando el mapa…</Text>
        </View>
      )}

      {/* Arriba y sin tapar el mapa: si la página escribió su propio error,
          tiene que seguir viéndose debajo de este aviso. */}
      {estado === 'fallo' && (
        <View style={[estilos.aviso, estilos.avisoFallo]}>
          <Text style={[estilos.avisoTexto, estilos.avisoTextoFallo]}>
            {motivo
              ? `El mapa no se pudo crear: ${motivo}`
              : 'El mapa no respondió. Revisa que Metro siga corriendo y que el teléfono esté en la misma red.'}
          </Text>
          <TouchableOpacity onPress={() => setIntento((n) => n + 1)}>
            <Text style={estilos.reintentar}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export const Mapa: React.FC<PropsMapa> = conGoogle ? MapaGoogle : MapaDeRespaldo;

const estilos = StyleSheet.create({
  contenedor: { flex: 1 },
  // Un tono de mapa y no blanco: al volver a la pestaña, mientras el mapa nuevo
  // carga, no hay un destello.
  fondo: { backgroundColor: '#EDEAE4' },
  aviso: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#ffffffee',
    elevation: 3,
  },
  avisoFallo: { backgroundColor: '#FAE5E3' },
  avisoTexto: { flex: 1, fontSize: 13, color: '#333' },
  avisoTextoFallo: { color: '#B32C24' },
  reintentar: { color: '#007AFF', fontWeight: '700', fontSize: 14 },
});
