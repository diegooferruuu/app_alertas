import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import incidentService, { Incident, CATEGORY_META } from '../../services/incident.service';

// La Paz, Bolivia por defecto (en web no hay GPS nativo de expo-location confiable)
const DEFAULT = { lat: -16.5, lng: -68.15 };

const MapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { identityVerified } = useAuth();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await incidentService.getNearby(DEFAULT.lat, DEFAULT.lng, 50000);
      setIncidents(data);
    } catch {
      // silencioso
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleReport = () => {
    if (identityVerified) {
      navigation.navigate('ReportIncident');
    } else {
      Alert.alert(
        'Verificación requerida',
        'Para reportar incidentes primero debes verificar tu identidad.',
        [
          { text: 'Ahora no', style: 'cancel' },
          { text: 'Verificar', onPress: () => navigation.navigate('PersonalData') },
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
        <ScrollView contentContainerStyle={styles.fallback}>
          <View style={styles.titleRow}>
            <Ionicons name="map" size={22} color="#1a1a1a" />
            <Text style={styles.title}>Mapa</Text>
          </View>
          <Text style={styles.subtitle}>
            El mapa interactivo solo está disponible en la app móvil. Aquí ves los
            incidentes cercanos como lista ({incidents.length}):
          </Text>
          {incidents.map((inc) => {
            const meta = CATEGORY_META[inc.category];
            return (
              <View key={inc.id} style={styles.item}>
                <View style={styles.itemTitleRow}>
                  <Ionicons name={meta.icon as any} size={18} color={meta.color} />
                  <Text style={[styles.itemTitle, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.itemDesc}>{inc.description}</Text>
                <View style={styles.itemCoordsRow}>
                  <Ionicons name="location-outline" size={13} color="#999" />
                  <Text style={styles.itemCoords}>
                    {inc.latitude.toFixed(4)}, {inc.longitude.toFixed(4)}
                  </Text>
                </View>
              </View>
            );
          })}
          {incidents.length === 0 && (
            <Text style={styles.empty}>No hay incidentes cercanos.</Text>
          )}
        </ScrollView>
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
  fallback: { padding: 20, paddingBottom: 100 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 20, lineHeight: 20 },
  item: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
  },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemDesc: { fontSize: 14, color: '#444', marginBottom: 6 },
  itemCoordsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  itemCoords: { fontSize: 12, color: '#999' },
  empty: { color: '#999', textAlign: 'center', marginTop: 20 },
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
  },
  reportText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export { MapScreen };
