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
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import denunciaService from '../../services/denuncia.service';

const ReportarDenunciaScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [nombrePersonaBuscada, setNombrePersonaBuscada] = useState('');
  const [ciPersonaBuscada, setCiPersonaBuscada] = useState('');
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
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

  const pickPhoto = async () => {
    if (Platform.OS === 'web') {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) setPhoto(result.assets[0].base64);
      return;
    }
    Alert.alert('Agregar foto', 'Elige una opción', [
      {
        text: 'Tomar foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          const r = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
          if (!r.canceled && r.assets[0].base64) setPhoto(r.assets[0].base64);
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            base64: true,
          });
          if (!r.canceled && r.assets[0].base64) setPhoto(r.assets[0].base64);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await denunciaService.create({
        nombre_persona_buscada: nombrePersonaBuscada.trim(),
        ci_persona_buscada: ciPersonaBuscada.trim(),
        description: description.trim(),
        latitude: coords!.lat,
        longitude: coords!.lng,
        photo_base64: photo ?? undefined,
      });
      Alert.alert('Denuncia registrada', 'Por ahora solo tú la ves. Firma la declaración para que se alerte a la zona.', [
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

  const handleSubmit = () => {
    if (nombrePersonaBuscada.trim().length < 2) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre de la persona desaparecida.');
      return;
    }
    if (!/^\d{5,12}$/.test(ciPersonaBuscada.trim())) {
      Alert.alert(
        'Falta el documento',
        'Necesitamos el número de carnet de la persona desaparecida. Es lo que le permite retirar la alerta si hubo un error.',
      );
      return;
    }
    if (description.trim().length < 5) {
      Alert.alert('Datos insuficientes', 'Agrega más detalles (mínimo 5 caracteres).');
      return;
    }
    if (!coords) {
      Alert.alert('Sin ubicación', 'No pudimos obtener tu ubicación. Activa el GPS e intenta de nuevo.');
      return;
    }

    // Aviso de confirmación antes de enviar
    Alert.alert(
      '¿Confirmar denuncia?',
      `Estás por registrar la desaparición de "${nombrePersonaBuscada.trim()}".\n\nPor ahora la verás solo tú. Para que se alerte a la zona tendrás que firmar una declaración jurada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, denunciar', style: 'destructive', onPress: submit },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Reportar desaparición</Text>

      <View style={styles.banner}>
        <Ionicons name="search" size={18} color="#FF3B30" />
        <Text style={styles.bannerText}>Denuncia de persona desaparecida</Text>
      </View>

      <Text style={styles.label}>Nombre de la persona desaparecida</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: María Pérez López"
        value={nombrePersonaBuscada}
        onChangeText={setNombrePersonaBuscada}
        autoCapitalize="words"
        maxLength={120}
      />

      <Text style={styles.label}>Número de carnet de la persona desaparecida</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 9876543"
        value={ciPersonaBuscada}
        onChangeText={(v) => setCiPersonaBuscada(v.replace(/\D/g, ''))}
        keyboardType="numeric"
        maxLength={12}
      />
      <Text style={styles.hint}>
        Lo pedimos porque es lo que permite a esa persona retirar la alerta si hubo
        un error. No guardamos el número: solo una huella cifrada de él.
      </Text>

      <Text style={styles.label}>Detalles</Text>
      <TextInput
        style={styles.textarea}
        placeholder="Edad, descripción física, ropa, última vez vista, contacto..."
        value={description}
        onChangeText={setDescription}
        multiline
        numberOfLines={5}
        maxLength={1000}
      />

      <Text style={styles.label}>Foto (opcional)</Text>
      {photo ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photo} />
          <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)}>
            <Ionicons name="close-circle" size={26} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
          <Ionicons name="camera-outline" size={22} color="#007AFF" />
          <Text style={styles.photoButtonText}>Agregar foto</Text>
        </TouchableOpacity>
      )}

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
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10, marginTop: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0EE',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  bannerText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },
  hint: { fontSize: 12, color: '#888', marginTop: 6, lineHeight: 17 },
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
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 13,
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

export { ReportarDenunciaScreen };
