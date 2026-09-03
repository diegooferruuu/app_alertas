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
import denunciaService, {
  Denuncia,
  DENUNCIA_META,
  situacionDe,
  primeraFotografia,
} from '../../services/denuncia.service';
import { useAuth } from '../../hooks/useAuth';

const DenunciaDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { id } = route.params;
  const { user } = useAuth();
  const [denuncia, setDenuncia] = useState<Denuncia | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await denunciaService.getOne(id);
      setDenuncia(data);
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

  if (loading || !denuncia) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const meta = DENUNCIA_META;
  const isOwner = user?.id === denuncia.denunciante_id;
  // Una vez firmada, el contenido queda sellado por su hash: editarlo rompería
  // la cadena probatoria.
  const editable = denuncia.nivel_confianza === 'REGISTRADA';
  const fotografia = primeraFotografia(denuncia);
  const date = new Date(denuncia.created_at).toLocaleString();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {fotografia ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${fotografia}` }}
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

        <Text style={styles.name}>{denuncia.nombre_persona_buscada || 'Sin nombre'}</Text>

        <Text style={styles.sectionLabel}>Detalles</Text>
        <Text style={styles.description}>{denuncia.description}</Text>

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={16} color="#888" />
          <Text style={styles.metaText}>{date}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={16} color="#888" />
          <Text style={styles.metaText}>
            {denuncia.latitude.toFixed(5)}, {denuncia.longitude.toFixed(5)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="flag-outline" size={16} color="#888" />
          <Text style={styles.metaText}>
            {situacionDe(denuncia).label} · {situacionDe(denuncia).desc}
          </Text>
        </View>

        {isOwner && (
          <View style={styles.ownerActions}>
            {editable ? (
              <>
                <TouchableOpacity
                  style={styles.firmarButton}
                  onPress={() =>
                    navigation.navigate('TextoLegal', { denunciaId: denuncia.id })
                  }
                >
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  <Text style={styles.firmarText}>Firmar para difundir</Text>
                </TouchableOpacity>
                <Text style={styles.firmarAyuda}>
                  Por ahora esta denuncia solo la ves tú. Al firmar la declaración
                  jurada empezará a alertarse a la zona.
                </Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate('EditDenuncia', { denuncia })}
                >
                  <Ionicons name="create-outline" size={18} color="#007AFF" />
                  <Text style={styles.editText}>Editar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.aviso}>
                <Ionicons name="lock-closed-outline" size={16} color="#8F5600" />
                <Text style={styles.avisoText}>
                  Ya declaraste esta denuncia bajo juramento, así que su contenido
                  quedó sellado. Las denuncias no se eliminan: la alerta deja de
                  difundirse al vencer su plazo.
                </Text>
              </View>
            )}
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
  ownerActions: { marginTop: 24, gap: 12 },
  firmarButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#B32C24',
  },
  firmarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  firmarAyuda: { fontSize: 13, color: '#777', lineHeight: 18, textAlign: 'center' },
  aviso: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#F9EEDA',
    borderRadius: 10,
    padding: 14,
  },
  avisoText: { flex: 1, fontSize: 13, color: '#6B4300', lineHeight: 19 },
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
});

export { DenunciaDetailScreen };
