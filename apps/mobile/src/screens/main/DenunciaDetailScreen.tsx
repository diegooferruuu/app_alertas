import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import denunciaService, {
  Denuncia,
  DENUNCIA_META,
  situacionDe,
  primeraFotografia,
  declaracionService,
} from '../../services/denuncia.service';

const DenunciaDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { id } = route.params;
  const [denuncia, setDenuncia] = useState<Denuncia | null>(null);
  const [loading, setLoading] = useState(true);
  const [numeroCaso, setNumeroCaso] = useState('');
  const [mostrarCampoCaso, setMostrarCampoCaso] = useState(false);
  const [guardandoCaso, setGuardandoCaso] = useState(false);

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
  const isOwner = denuncia.es_mia;
  // Una denuncia INVALIDADA o CERRADA ya no admite respaldo; una CADUCADA sí,
  // porque una corroboración tardía puede devolverla a difusión.
  const admiteRespaldo =
    denuncia.nivel_confianza !== 'REGISTRADA' &&
    denuncia.estado !== 'INVALIDADA' &&
    denuncia.estado !== 'CERRADA';

  const registrarCaso = async () => {
    setGuardandoCaso(true);
    try {
      await declaracionService.registrarCasoFelcc(denuncia.id, numeroCaso.trim());
      setMostrarCampoCaso(false);
      setNumeroCaso('');
      await load();
      Alert.alert(
        'Caso registrado',
        'La denuncia quedó respaldada por el caso formal y su alerta amplía el alcance.',
      );
    } catch (err: any) {
      Alert.alert(
        'No se pudo registrar',
        err?.response?.data?.message || 'Revisa el número e intenta de nuevo.',
      );
    } finally {
      setGuardandoCaso(false);
    }
  };
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
        {denuncia.numero_caso_felcc && (
          <View style={styles.metaRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#0E7247" />
            <Text style={styles.metaText}>
              Caso FELCC {denuncia.numero_caso_felcc}
            </Text>
          </View>
        )}

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
              <>
                <View style={styles.aviso}>
                  <Ionicons name="lock-closed-outline" size={16} color="#8F5600" />
                  <Text style={styles.avisoText}>
                    Ya declaraste esta denuncia bajo juramento, así que su contenido
                    quedó sellado. Las denuncias no se eliminan: la alerta deja de
                    difundirse al vencer su plazo.
                  </Text>
                </View>

                {/* La otra vía de corroboración: el respaldo de una denuncia
                    formal ante la FELCC. Amplía radio y plazo sin necesitar que
                    otra persona firme. */}
                {admiteRespaldo && !denuncia.numero_caso_felcc && (
                  <View style={styles.casoBloque}>
                    {mostrarCampoCaso ? (
                      <>
                        <Text style={styles.casoEtiqueta}>
                          Número de caso de la FELCC
                        </Text>
                        <TextInput
                          style={styles.casoCampo}
                          value={numeroCaso}
                          onChangeText={setNumeroCaso}
                          placeholder="Ej. 1234/2026"
                          autoCapitalize="characters"
                          autoCorrect={false}
                        />
                        <View style={styles.casoAcciones}>
                          <TouchableOpacity
                            style={styles.casoCancelar}
                            onPress={() => {
                              setMostrarCampoCaso(false);
                              setNumeroCaso('');
                            }}
                          >
                            <Text style={styles.casoCancelarText}>Cancelar</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.casoGuardar,
                              numeroCaso.trim().length < 3 && styles.casoGuardarOff,
                            ]}
                            disabled={numeroCaso.trim().length < 3 || guardandoCaso}
                            onPress={registrarCaso}
                          >
                            {guardandoCaso ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={styles.casoGuardarText}>Registrar</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={styles.editButton}
                        onPress={() => setMostrarCampoCaso(true)}
                      >
                        <Ionicons name="shield-outline" size={18} color="#007AFF" />
                        <Text style={styles.editText}>Registrar caso FELCC</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Corroborar la denuncia de otra persona. Compromete igual que
            denunciar, así que pasa por la misma declaración jurada. */}
        {!isOwner && admiteRespaldo && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.corroborarButton}
              onPress={() =>
                navigation.navigate('TextoLegal', {
                  denunciaId: denuncia.id,
                  modo: 'corroborar',
                })
              }
            >
              <Ionicons name="people-outline" size={18} color="#fff" />
              <Text style={styles.firmarText}>Corroborar esta denuncia</Text>
            </TouchableOpacity>
            <Text style={styles.firmarAyuda}>
              Solo si te consta. Al corroborar firmas tu propia declaración jurada
              y tu identidad queda asociada al caso.
            </Text>
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
  corroborarButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#1F4FD8',
  },
  casoBloque: { gap: 10 },
  casoEtiqueta: { fontSize: 14, fontWeight: '600', color: '#333' },
  casoCampo: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  casoAcciones: { flexDirection: 'row', gap: 10 },
  casoCancelar: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  casoCancelarText: { color: '#666', fontWeight: '600' },
  casoGuardar: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#0E7247',
    alignItems: 'center',
  },
  casoGuardarOff: { backgroundColor: '#c3c9d6' },
  casoGuardarText: { color: '#fff', fontWeight: '700' },
});

export { DenunciaDetailScreen };
