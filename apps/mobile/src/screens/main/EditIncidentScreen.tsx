import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import incidentService, { Incident } from '../../services/incident.service';

const EditIncidentScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const incident: Incident = route.params.incident;
  const [victimName, setVictimName] = useState(incident.victim_name || '');
  const [description, setDescription] = useState(incident.description);
  const [photo, setPhoto] = useState<string | null>(incident.photo_base64);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.5,
      base64: true,
    });
    if (!r.canceled && r.assets[0].base64) setPhoto(r.assets[0].base64);
  };

  const handleSave = async () => {
    if (victimName.trim().length < 2) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre de la persona desaparecida.');
      return;
    }
    if (description.trim().length < 5) {
      Alert.alert('Datos insuficientes', 'Agrega más detalles (mínimo 5 caracteres).');
      return;
    }

    setSaving(true);
    try {
      await incidentService.update(incident.id, {
        victim_name: victimName.trim(),
        description: description.trim(),
        // Solo enviamos la foto si cambió a una nueva (base64 sin prefijo data:)
        ...(photo && photo !== incident.photo_base64 ? { photo_base64: photo } : {}),
      });
      Alert.alert('Guardado', 'La denuncia fue actualizada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Editar denuncia</Text>

      <Text style={styles.label}>Nombre de la víctima</Text>
      <TextInput
        style={styles.input}
        value={victimName}
        onChangeText={setVictimName}
        autoCapitalize="words"
        maxLength={120}
      />

      <Text style={styles.label}>Detalles</Text>
      <TextInput
        style={styles.textarea}
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        maxLength={1000}
      />

      <Text style={styles.label}>Foto</Text>
      {photo ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photo} />
          <TouchableOpacity style={styles.photoChange} onPress={pickPhoto}>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.photoChangeText}>Cambiar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
          <Ionicons name="camera-outline" size={22} color="#007AFF" />
          <Text style={styles.photoButtonText}>Agregar foto</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Guardar cambios</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#1a1a1a' },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
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
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  photoButtonText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 200, borderRadius: 10, resizeMode: 'cover' },
  photoChange: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  photoChangeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export { EditIncidentScreen };
