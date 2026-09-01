import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useAuth } from '../../hooks/useAuth';
import denunciaService, { Denuncia, DENUNCIA_META } from '../../services/denuncia.service';

// La Paz, Bolivia como ubicación por defecto si no hay GPS
const DEFAULT_REGION = {
  latitude: -16.5,
  longitude: -68.15,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const MapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { documentoRegistrado } = useAuth();
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(true);

  const loadNearby = useCallback(async (lat: number, lng: number) => {
    try {
      const data = await denunciaService.getNearby(lat, lng, 10000);
      setDenuncias(data);
    } catch {
      // silencioso
    }
  }, []);

  const initLocation = useCallback(async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = DEFAULT_REGION.latitude;
      let lng = DEFAULT_REGION.longitude;

      if (status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({});
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        setRegion({ ...DEFAULT_REGION, latitude: lat, longitude: lng });
      }
      await loadNearby(lat, lng);
    } finally {
      setLoading(false);
    }
  }, [loadNearby]);

  useEffect(() => {
    initLocation();
  }, [initLocation]);

  useFocusEffect(
    useCallback(() => {
      loadNearby(region.latitude, region.longitude);
    }, [loadNearby, region.latitude, region.longitude]),
  );

  const handleReport = () => {
    if (documentoRegistrado) {
      navigation.navigate('ReportarDenuncia');
    } else {
      Alert.alert(
        'Documento requerido',
        'Para reportar primero debes registrar tu documento de identidad.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Registrar', onPress: () => navigation.navigate('PersonalData') },
        ],
      );
    }
  };

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <MapView style={styles.map} region={region} showsUserLocation>
          {denuncias.map((inc) => {
            const meta = DENUNCIA_META;
            return (
              <Marker
                key={inc.id}
                coordinate={{ latitude: inc.latitude, longitude: inc.longitude }}
                title={meta.label}
                description={inc.description}
                pinColor={meta.color}
              />
            );
          })}
        </MapView>
      )}

      <TouchableOpacity style={styles.reportButton} onPress={handleReport}>
        <Ionicons name="add" size={22} color="#fff" style={{ marginRight: 6 }} />
        <Text style={styles.reportText}>Reportar</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  map: { flex: 1 },
  reportButton: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    backgroundColor: '#FF3B30',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 30,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  reportText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export { MapScreen };
