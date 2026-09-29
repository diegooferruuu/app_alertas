import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';

export interface Coordenadas {
  lat: number;
  lng: number;
}

/**
 * Versión para navegador.
 *
 * `react-native-maps` no funciona en web, así que aquí solo se ofrece la
 * ubicación del navegador. La app se usa en el teléfono; esta variante existe
 * para que la versión web no se rompa al compilar, no para dar la misma
 * experiencia.
 */
export const SelectorDeUbicacion: React.FC<{
  valor: Coordenadas | null;
  onChange: (coords: Coordenadas) => void;
}> = ({ valor, onChange }) => {
  const [buscando, setBuscando] = useState(false);

  const usarUbicacion = async () => {
    setBuscando(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({});
      onChange({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setBuscando(false);
    }
  };

  return (
    <View style={estilos.contenedor}>
      <Text style={estilos.etiqueta}>¿Dónde se la vio por última vez?</Text>
      <TouchableOpacity style={estilos.opcion} onPress={usarUbicacion} disabled={buscando}>
        {buscando ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Ionicons name="navigate" size={20} color="#007AFF" />
        )}
        <Text style={estilos.opcionTexto}>Usar mi ubicación</Text>
      </TouchableOpacity>
      <Text style={estilos.ayuda}>
        {valor
          ? `Zona seleccionada: ${valor.lat.toFixed(4)}, ${valor.lng.toFixed(4)}`
          : 'Todavía sin elegir.'}{' '}
        Para elegir un punto en el mapa, usa la aplicación en el teléfono.
      </Text>
    </View>
  );
};

const estilos = StyleSheet.create({
  contenedor: { marginTop: 16 },
  etiqueta: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderRadius: 10,
    paddingVertical: 13,
  },
  opcionTexto: { color: '#007AFF', fontSize: 14, fontWeight: '600' },
  ayuda: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 17 },
});
