import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import incidentService, { Incident, CATEGORY_META } from '../../services/incident.service';

const MyIncidentsScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await incidentService.getMine();
      setIncidents(data);
    } catch {
      // lista vacía si falla
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = (id: string) => {
    Alert.alert('Borrar denuncia', '¿Seguro que quieres borrar esta denuncia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await incidentService.remove(id);
            setIncidents((prev) => prev.filter((i) => i.id !== id));
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'No se pudo borrar.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <FlatList
      data={incidents}
      keyExtractor={(item) => item.id}
      contentContainerStyle={incidents.length === 0 ? styles.empty : styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
      ListEmptyComponent={
        <Text style={styles.emptyText}>Aún no has realizado ninguna denuncia.</Text>
      }
      renderItem={({ item }) => {
        const meta = CATEGORY_META[item.category];
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('IncidentDetail', { id: item.id })}
          >
            <View style={[styles.iconBadge, { backgroundColor: `${meta.color}20` }]}>
              <Ionicons name={meta.icon as any} size={20} color={meta.color} />
            </View>
            <View style={styles.body}>
              <Text style={styles.name}>{item.victim_name || 'Sin nombre'}</Text>
              <Text style={styles.desc} numberOfLines={1}>
                {item.description}
              </Text>
            </View>
            <View style={styles.actions}>
              <TouchableOpacity
                onPress={() => navigation.navigate('EditIncident', { incident: item })}
                hitSlop={8}
              >
                <Ionicons name="create-outline" size={22} color="#007AFF" />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={22} color="#FF3B30" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  empty: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  body: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginBottom: 2 },
  desc: { fontSize: 13, color: '#888' },
  actions: { flexDirection: 'row', gap: 16, marginLeft: 8 },
});

export { MyIncidentsScreen };
