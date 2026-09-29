import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Mapa } from './mapa/Mapa';
import { AMPLITUD_INICIAL, CENTRO_POR_DEFECTO } from '../utils/ubicacion-inicial';

export interface Coordenadas {
  lat: number;
  lng: number;
}

interface Props {
  valor: Coordenadas | null;
  onChange: (coords: Coordenadas) => void;
}

/**
 * Radio de la zona que se dibuja, en metros.
 *
 * Coincide con lo que el servidor guarda de verdad: el punto exacto se reduce a
 * una celda de ~1 km. Dibujarlo no es decoración —es lo que hace visible para
 * quien denuncia que no se está guardando el portón que acaba de marcar.
 */
const RADIO_ZONA_M = 550;

/**
 * Dónde se vio por última vez a la persona.
 *
 * Antes se tomaba siempre la posición del teléfono, lo que falla en el caso más
 * común: alguien denuncia desde su casa una desaparición ocurrida en otro lado.
 * La alerta se difundía alrededor de quien denuncia y no de donde se vio a la
 * persona buscada, que es lo único que sirve para que alguien la reconozca.
 */
export const SelectorDeUbicacion: React.FC<Props> = ({ valor, onChange }) => {
  const [buscandoGps, setBuscandoGps] = useState(false);
  const [mapaAbierto, setMapaAbierto] = useState(false);
  const [provisional, setProvisional] = useState<Coordenadas | null>(valor);
  const [region, setRegion] = useState({
    ...CENTRO_POR_DEFECTO,
    latitudeDelta: AMPLITUD_INICIAL,
    longitudeDelta: AMPLITUD_INICIAL,
  });

  // Se ofrece el GPS de entrada porque en muchos casos sí es el lugar correcto,
  // pero sin imponerlo: queda como una opción entre dos.
  useEffect(() => {
    if (valor) {
      setRegion((r) => ({ ...r, latitude: valor.lat, longitude: valor.lng }));
    }
  }, [valor]);

  const usarGps = async () => {
    setBuscandoGps(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      onChange(coords);
      setRegion((r) => ({ ...r, latitude: coords.lat, longitude: coords.lng }));
    } finally {
      setBuscandoGps(false);
    }
  };

  const abrirMapa = async () => {
    setProvisional(valor);
    if (!valor) {
      // Centrar donde está el teléfono ahorra buscar la ciudad a mano, aunque
      // después se marque otro punto.
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setRegion((r) => ({
            ...r,
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }));
        }
      } catch {
        // Sin permiso se abre en el centro por defecto; no es motivo para no abrir el mapa.
      }
    }
    setMapaAbierto(true);
  };

  const confirmar = () => {
    if (provisional) onChange(provisional);
    setMapaAbierto(false);
  };

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>¿Dónde se la vio por última vez?</Text>

      <View style={estilos.opciones}>
        <TouchableOpacity
          style={estilos.opcion}
          onPress={usarGps}
          disabled={buscandoGps}
          accessibilityRole="button"
        >
          {buscandoGps ? (
            <ActivityIndicator size="small" color="#007AFF" />
          ) : (
            <Ionicons name="navigate" size={20} color="#007AFF" />
          )}
          <Text style={estilos.opcionTexto}>Mi ubicación actual</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={estilos.opcion}
          onPress={abrirMapa}
          accessibilityRole="button"
        >
          <Ionicons name="map" size={20} color="#007AFF" />
          <Text style={estilos.opcionTexto}>Elegir en el mapa</Text>
        </TouchableOpacity>
      </View>

      {valor ? (
        <View style={estilos.elegida}>
          <Ionicons name="checkmark-circle" size={16} color="#2C6B3F" />
          <Text style={estilos.elegidaTexto}>
            Zona seleccionada: {valor.lat.toFixed(4)}, {valor.lng.toFixed(4)}
          </Text>
        </View>
      ) : (
        <View style={estilos.faltante}>
          <Ionicons name="alert-circle-outline" size={16} color="#8A5A11" />
          <Text style={estilos.faltanteTexto}>Todavía sin elegir</Text>
        </View>
      )}

      {/*
        Decirlo antes de que marquen, no después. Quien elige un punto en un mapa
        asume que se guarda ese punto; que no sea así tiene que ser visible.
      */}
      <Text style={estilos.ayuda}>
        Solo se guarda la zona aproximada de un kilómetro, nunca el punto exacto.
      </Text>

      <Modal
        visible={mapaAbierto}
        animationType="slide"
        onRequestClose={() => setMapaAbierto(false)}
      >
        <View style={estilos.modal}>
          <View style={estilos.barra}>
            <TouchableOpacity onPress={() => setMapaAbierto(false)}>
              <Text style={estilos.cancelar}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={estilos.tituloModal}>Toca el lugar</Text>
            <TouchableOpacity onPress={confirmar} disabled={!provisional}>
              <Text
                style={[estilos.confirmar, !provisional && estilos.deshabilitado]}
              >
                Listo
              </Text>
            </TouchableOpacity>
          </View>

          {/*
            El círculo es la zona que realmente se guarda. Ver el punto dentro
            de un área y no como una chincheta exacta es lo que comunica la
            reducción sin tener que leer un aviso.
          */}
          <Mapa
            style={estilos.mapa}
            region={region}
            marcadores={
              provisional
                ? [
                    {
                      id: 'elegido',
                      lat: provisional.lat,
                      lng: provisional.lng,
                      titulo: 'Zona elegida',
                      color: '#FF3B30',
                    },
                  ]
                : []
            }
            zona={
              provisional
                ? { lat: provisional.lat, lng: provisional.lng, radioM: RADIO_ZONA_M }
                : null
            }
            alTocar={setProvisional}
          />

          <View style={estilos.pie}>
            <Text style={estilos.pieTexto}>
              {provisional
                ? 'Se guardará la zona marcada, no el punto exacto.'
                : 'Toca el mapa donde se la vio por última vez.'}
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: { marginTop: 16 },
  etiqueta: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  opciones: { flexDirection: 'row', gap: 10 },
  opcion: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 13,
    paddingHorizontal: 8,
  },
  opcionTexto: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  elegida: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#E4EFE7',
    borderRadius: 8,
  },
  elegidaTexto: { fontSize: 13, color: '#2C6B3F' },
  faltante: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    padding: 10,
    backgroundColor: '#F7EEDC',
    borderRadius: 8,
  },
  faltanteTexto: { fontSize: 13, color: '#8A5A11' },
  ayuda: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 17 },
  modal: { flex: 1, backgroundColor: '#fff' },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingTop: 54,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tituloModal: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  cancelar: { fontSize: 16, color: '#666' },
  confirmar: { fontSize: 16, color: '#007AFF', fontWeight: '700' },
  deshabilitado: { color: '#bbb' },
  mapa: { flex: 1 },
  pie: {
    padding: 16,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    backgroundColor: '#fafafa',
  },
  pieTexto: { fontSize: 13, color: '#555', textAlign: 'center' },
});
