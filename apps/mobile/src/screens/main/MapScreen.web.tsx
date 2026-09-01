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
import denunciaService, { Denuncia, DENUNCIA_META } from '../../services/denuncia.service';

// La Paz, Bolivia por defecto (en web no hay GPS nativo de expo-location confiable)
const DEFAULT = { lat: -16.5, lng: -68.15 };

const MapScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { documentoRegistrado } = useAuth();
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await denunciaService.getNearby(DEFAULT.lat, DEFAULT.lng, 50000);
      setDenuncias(data);
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
        <ScrollView contentContainerStyle={styles.fallback}>
          <View style={styles.titleRow}>
            <Ionicons name="map" size={22} color="#1a1a1a" />
            <Text style={styles.title}>Mapa</Text>
          </View>
          <Text style={styles.subtitle}>
            El mapa interactivo solo está disponible en la app móvil. Aquí ves los
            denuncias cercanas como lista ({denuncias.length}):
          </Text>
          {denuncias.map((inc) => {
            const meta = DENUNCIA_META;
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
          {denuncias.length === 0 && (
            <Text style={styles.empty}>No hay denuncias cercanas.</Text>
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
