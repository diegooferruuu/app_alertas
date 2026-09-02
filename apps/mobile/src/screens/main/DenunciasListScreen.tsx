import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import denunciaService, {
  Denuncia,
  DENUNCIA_META,
  situacionDe,
} from '../../services/denuncia.service';

// La Paz, Bolivia por defecto si no hay GPS
const DEFAULT = { lat: -16.5, lng: -68.15 };

type SortMode = 'recent' | 'nearby';

const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} d`;
};

const formatDistance = (meters?: number): string => {
  if (meters == null) return '';
  if (meters < 1000) return `${meters} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const DenunciasListScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  const load = useCallback(async (mode: SortMode) => {
    try {
      if (mode === 'recent') {
        const data = await denunciaService.getRecent();
        setDenuncias(data);
      } else {
        // Ordenar por cercanía: obtener ubicación y usar el endpoint nearby
        let lat = DEFAULT.lat;
        let lng = DEFAULT.lng;
        try {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === 'granted') {
            const pos = await Location.getCurrentPositionAsync({});
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
          }
        } catch {
          // sin GPS: usa default
        }
        const data = await denunciaService.getNearby(lat, lng, 100000);
        setDenuncias(data);
      }
    } catch {
      // si falla, lista vacía
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(sortMode);
    }, [load, sortMode]),
  );

  const changeSort = (mode: SortMode) => {
    if (mode === sortMode) return;
    setLoading(true);
    setSortMode(mode);
    load(mode);
  };

  const onRefresh = () => {
    setRefreshing(true);
    load(sortMode);
  };

  return (
    <View style={styles.screen}>
      {/* Selector de orden */}
      <View style={styles.sortBar}>
        <TouchableOpacity
          style={[styles.sortButton, sortMode === 'recent' && styles.sortButtonActive]}
          onPress={() => changeSort('recent')}
        >
          <Ionicons
            name="time-outline"
            size={16}
            color={sortMode === 'recent' ? '#fff' : '#555'}
          />
          <Text style={[styles.sortText, sortMode === 'recent' && styles.sortTextActive]}>
            Más reciente
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortMode === 'nearby' && styles.sortButtonActive]}
          onPress={() => changeSort('nearby')}
        >
          <Ionicons
            name="location-outline"
            size={16}
            color={sortMode === 'nearby' ? '#fff' : '#555'}
          />
          <Text style={[styles.sortText, sortMode === 'nearby' && styles.sortTextActive]}>
            Más cercano
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : (
        <FlatList
          data={denuncias}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            denuncias.length === 0 ? styles.emptyContainer : styles.list
          }
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No hay denuncias reportadas todavía.</Text>
          }
          renderItem={({ item }) => {
            const meta = DENUNCIA_META;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('DenunciaDetail', { id: item.id })}
              >
                <View style={[styles.iconBadge, { backgroundColor: `${meta.color}20` }]}>
                  <Ionicons name={meta.icon as any} size={22} color={meta.color} />
                </View>
                <View style={styles.cardBody}>
                  <View style={styles.cardHeader}>
                    <Text style={[styles.category, { color: meta.color }]} numberOfLines={1}>
                      {item.nombre_persona_buscada || meta.label}
                    </Text>
                    <Text style={styles.time}>
                      {sortMode === 'nearby' && item.distance_meters != null
                        ? formatDistance(item.distance_meters)
                        : timeAgo(item.created_at)}
                    </Text>
                  </View>
                  <Text style={styles.description} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <Text style={[styles.status, { color: situacionDe(item).color }]}>
                    {situacionDe(item).label}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#ccc" />
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sortBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sortButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#f2f2f2',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sortButtonActive: { backgroundColor: '#007AFF' },
  sortText: { fontSize: 13, color: '#555', fontWeight: '600' },
  sortTextActive: { color: '#fff' },
  list: { padding: 16 },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { color: '#999', fontSize: 15, textAlign: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  iconBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardBody: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  category: { fontSize: 15, fontWeight: '700' },
  time: { fontSize: 12, color: '#999' },
  description: { fontSize: 14, color: '#444', marginBottom: 6 },
  status: { fontSize: 12, fontWeight: '600' },
});

export { DenunciasListScreen };
