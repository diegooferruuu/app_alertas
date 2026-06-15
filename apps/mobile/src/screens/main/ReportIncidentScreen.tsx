import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import incidentService from '../../services/incident.service';

const ReportIncidentScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [description, setDescription] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const handleSubmit = async () => {
    if (description.trim().length < 5) {
      Alert.alert('Datos insuficientes', 'Describe a la persona desaparecida (mínimo 5 caracteres).');
      return;
    }
    if (!coords) {
      Alert.alert('Sin ubicación', 'No pudimos obtener tu ubicación. Activa el GPS e intenta de nuevo.');
      return;
    }

    setSubmitting(true);
    try {
      await incidentService.create({
        category: 'desaparicion',
        description: description.trim(),
        latitude: coords.lat,
        longitude: coords.lng,
      });
      Alert.alert('¡Reportado!', 'La denuncia de desaparición fue registrada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert(
        'Error al reportar',
        err?.response?.data?.message || err?.message || 'Intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Reportar desaparición</Text>

      <View style={styles.banner}>
        <Ionicons name="search" size={18} color="#FF3B30" />
        <Text style={styles.bannerText}>Denuncia de persona desaparecida</Text>
      </View>

      <Text style={styles.label}>Datos de la persona desaparecida</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Nombre, edad, descripción física, ropa, última vez vista..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        maxLength={500}
      />

      <View style={styles.locationBox}>
        {locating ? (
          <>
            <Ionicons name="location-outline" size={16} color="#444" />
            <Text style={styles.locationText}>Obteniendo ubicación...</Text>
          </>
        ) : coords ? (
          <>
            <Ionicons name="location" size={16} color="#007AFF" />
            <Text style={styles.locationText}>
              Ubicación: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="warning" size={16} color="#FF3B30" />
            <Text style={[styles.locationText, { color: '#FF3B30' }]}>
              Sin ubicación (activa el GPS)
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, (submitting || locating) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || locating}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Enviar reporte</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#1a1a1a' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10, marginTop: 8 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0EE',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  bannerText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },
  textarea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: '#fafafa',
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
  },
  locationText: { fontSize: 13, color: '#444' },
  button: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export { ReportIncidentScreen };
