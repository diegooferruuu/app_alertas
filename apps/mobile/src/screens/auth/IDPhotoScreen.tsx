import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/auth.store';

const IDPhotoScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { verifyIdCard, isLoading } = useAuthStore();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async (side: 'front' | 'back') => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
        return;
      }
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (side === 'front') {
          setFrontImage(result.assets[0].base64);
        } else {
          setBackImage(result.assets[0].base64);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async (side: 'front' | 'back') => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso requerido', 'Necesitamos acceso a tu cámara.');
        return;
      }
    }

    setLoading(true);
    try {
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0].base64) {
        if (side === 'front') {
          setFrontImage(result.assets[0].base64);
        } else {
          setBackImage(result.assets[0].base64);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const showOptions = (side: 'front' | 'back') => {
    if (Platform.OS === 'web') {
      pickImage(side);
      return;
    }
    Alert.alert('Cargar foto', 'Elige una opción', [
      { text: 'Tomar foto', onPress: () => takePhoto(side) },
      { text: 'Galería', onPress: () => pickImage(side) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const handleNext = async () => {
    if (!frontImage || !backImage) {
      Alert.alert('Fotos requeridas', 'Por favor sube el anverso y reverso de tu carnet.');
      return;
    }

    try {
      // Valida calidad de imagen + coincidencia de datos contra el OCR del backend
      await verifyIdCard(frontImage, backImage);
      navigation.navigate('Selfie');
    } catch (err: any) {
      Alert.alert(
        'Verificación del carnet fallida',
        err?.response?.data?.message ||
          err?.message ||
          'No pudimos leer tus datos del carnet. Asegúrate de que la foto sea clara y legible.',
      );
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Foto del Carnet</Text>
      <Text style={styles.subtitle}>
        Sube una foto clara del anverso y reverso de tu carnet de identidad.
      </Text>

      {loading && <ActivityIndicator size="large" color="#007AFF" style={{ marginBottom: 16 }} />}

      {/* Anverso */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionLabel}>Anverso (frente)</Text>
        {frontImage ? (
          <View>
            <Image
              source={{ uri: `data:image/jpeg;base64,${frontImage}` }}
              style={styles.preview}
            />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => showOptions('front')}>
              <Text style={styles.retakeBtnText}>Cambiar foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadBox} onPress={() => showOptions('front')}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>Subir anverso</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Reverso */}
      <View style={styles.photoSection}>
        <Text style={styles.sectionLabel}>Reverso (dorso)</Text>
        {backImage ? (
          <View>
            <Image
              source={{ uri: `data:image/jpeg;base64,${backImage}` }}
              style={styles.preview}
            />
            <TouchableOpacity style={styles.retakeBtn} onPress={() => showOptions('back')}>
              <Text style={styles.retakeBtnText}>Cambiar foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadBox} onPress={() => showOptions('back')}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>Subir reverso</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.button,
          (!frontImage || !backImage || isLoading) && styles.buttonDisabled,
        ]}
        onPress={handleNext}
        disabled={!frontImage || !backImage || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Validar carnet y continuar →</Text>
        )}
      </TouchableOpacity>

      <View style={styles.steps}>
        <View style={styles.stepDot} />
        <View style={[styles.stepDot, styles.stepActive]} />
        <View style={styles.stepDot} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
    lineHeight: 20,
  },
  photoSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  uploadBox: {
    height: 160,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
  },
  uploadIcon: {
    fontSize: 36,
    marginBottom: 8,
  },
  uploadText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    resizeMode: 'cover',
  },
  retakeBtn: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  retakeBtnText: {
    color: '#007AFF',
    fontSize: 13,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#b0c4de',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  steps: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ddd',
  },
  stepActive: {
    backgroundColor: '#007AFF',
  },
});

export { IDPhotoScreen };
