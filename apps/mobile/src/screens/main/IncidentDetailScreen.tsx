import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import incidentService, { Incident, CATEGORY_META } from '../../services/incident.service';
import { useAuth } from '../../hooks/useAuth';

const IncidentDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { id } = route.params;
  const { user } = useAuth();
  const [incident, setIncident] = useState<Incident | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await incidentService.getOne(id);
      setIncident(data);
    } catch {
      Alert.alert('Error', 'No se pudo cargar la denuncia.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleDelete = () => {
    Alert.alert('Borrar denuncia', '¿Seguro que quieres borrar esta denuncia?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await incidentService.remove(id);
            navigation.goBack();
          } catch (err: any) {
            Alert.alert('Error', err?.response?.data?.message || 'No se pudo borrar.');
          }
        },
      },
    ]);
  };

  if (loading || !incident) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const meta = CATEGORY_META[incident.category];
  const isOwner = user?.id === incident.reporter_id;
  const date = new Date(incident.created_at).toLocaleString();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {incident.photo_base64 ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${incident.photo_base64}` }}
          style={styles.photo}
        />
      ) : (
        <View style={[styles.noPhoto, { backgroundColor: `${meta.color}15` }]}>
          <Ionicons name={meta.icon as any} size={48} color={meta.color} />
        </View>
      )}

      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: `${meta.color}20` }]}>
          <Ionicons name={meta.icon as any} size={14} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <Text style={styles.name}>{incident.victim_name || 'Sin nombre'}</Text>

        <Text style={styles.sectionLabel}>Detalles</Text>
        <Text style={styles.description}>{incident.description}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={16} color="#888" />
          <Text style={styles.metaText}>{date}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={16} color="#888" />
          <Text style={styles.metaText}>
            {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="flag-outline" size={16} color="#888" />
          <Text style={styles.metaText}>Estado: {incident.status}</Text>
        </View>

        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => navigation.navigate('EditIncident', { incident })}
            >
              <Ionicons name="create-outline" size={18} color="#007AFF" />
              <Text style={styles.editText}>Editar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Ionicons name="trash-outline" size={18} color="#fff" />
              <Text style={styles.deleteText}>Borrar</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#fff', flexGrow: 1 },
  photo: { width: '100%', height: 260, resizeMode: 'cover' },
  noPhoto: { width: '100%', height: 180, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 6 },
  description: { fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metaText: { fontSize: 13, color: '#888' },
  ownerActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  editButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  editText: { color: '#007AFF', fontWeight: '600' },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#FF3B30',
  },
  deleteText: { color: '#fff', fontWeight: '600' },
});

export { IncidentDetailScreen };
