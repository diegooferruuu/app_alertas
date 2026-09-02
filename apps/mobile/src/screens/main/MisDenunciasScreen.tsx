import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import denunciaService, {
  Denuncia,
  DENUNCIA_META,
  situacionDe,
} from '../../services/denuncia.service';

const MisDenunciasScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [denuncias, setDenuncias] = useState<Denuncia[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await denunciaService.getMine();
      setDenuncias(data);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <FlatList
      data={denuncias}
      keyExtractor={(item) => item.id}
      contentContainerStyle={denuncias.length === 0 ? styles.empty : styles.list}
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
        const meta = DENUNCIA_META;
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('DenunciaDetail', { id: item.id })}
          >
            <View style={[styles.iconBadge, { backgroundColor: `${meta.color}20` }]}>
              <Ionicons name={meta.icon as any} size={20} color={meta.color} />
            </View>
            <View style={styles.body}>
              <Text style={styles.name}>{item.nombre_persona_buscada || 'Sin nombre'}</Text>
              <Text style={[styles.situacion, { color: situacionDe(item).color }]}>
                {situacionDe(item).label}
              </Text>
            </View>
            <View style={styles.actions}>
              {item.nivel_confianza === 'REGISTRADA' && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('EditDenuncia', { denuncia: item })}
                  hitSlop={8}
                >
                  <Ionicons name="create-outline" size={22} color="#007AFF" />
                </TouchableOpacity>
              )}
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
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
  situacion: { fontSize: 12, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 16, marginLeft: 8 },
});

export { MisDenunciasScreen };
