import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../store/auth.store';

const SelfieScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { verifyIdentity, isLoading, error } = useAuthStore();
  const [selfieImage, setSelfieImage] = useState<string | null>(null);

  const takeSelfie = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permiso requerido',
        'Necesitamos acceso a tu cámara para tomar la selfie en vivo.',
      );
      return;
    }

    // La selfie SIEMPRE se captura en vivo con la cámara (no se permite galería)
    const result = await ImagePicker.launchCameraAsync({
      cameraType: ImagePicker.CameraType.front,
      quality: 0.8,
      base64: true,
      allowsEditing: false,
    });

    if (!result.canceled && result.assets[0].base64) {
      setSelfieImage(result.assets[0].base64);
    }
  };

  const handleVerify = async () => {
    if (!selfieImage) {
      Alert.alert('Selfie requerida', 'Por favor toma una selfie para continuar.');
      return;
    }

    try {
      await verifyIdentity(selfieImage);
      Alert.alert(
        '¡Verificado!',
        'Tu identidad ha sido verificada correctamente.',
        [{ text: 'Continuar', onPress: () => navigation.navigate('Home') }],
      );
    } catch (err: any) {
      Alert.alert(
        'Verificación fallida',
        err?.response?.data?.message || err?.message || 'Error al verificar identidad.',
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Selfie</Text>
      <Text style={styles.subtitle}>
        Toma una foto de tu cara para compararla con la foto de tu carnet.
      </Text>

      <View style={styles.hints}>
        <Text style={styles.hint}>• Asegúrate de tener buena iluminación</Text>
        <Text style={styles.hint}>• Mira directamente a la cámara</Text>
        <Text style={styles.hint}>• No uses gafas ni cubras tu rostro</Text>
      </View>

      {selfieImage ? (
        <View style={styles.previewContainer}>
          <Image
            source={{ uri: `data:image/jpeg;base64,${selfieImage}` }}
            style={styles.preview}
          />
          <TouchableOpacity style={styles.retakeBtn} onPress={takeSelfie}>
            <Text style={styles.retakeBtnText}>Tomar otra selfie</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.cameraBox} onPress={takeSelfie}>
          <Text style={styles.cameraIcon}>🤳</Text>
          <Text style={styles.cameraText}>Tomar selfie</Text>
        </TouchableOpacity>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, (!selfieImage || isLoading) && styles.buttonDisabled]}
        onPress={handleVerify}
        disabled={!selfieImage || isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verificar identidad</Text>
        )}
      </TouchableOpacity>

      <View style={styles.steps}>
        <View style={styles.stepDot} />
        <View style={styles.stepDot} />
        <View style={[styles.stepDot, styles.stepActive]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    marginBottom: 20,
    lineHeight: 20,
  },
  hints: {
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
  },
  hint: {
    fontSize: 13,
    color: '#444',
    marginBottom: 4,
    lineHeight: 20,
  },
  cameraBox: {
    height: 220,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f7ff',
    alignSelf: 'center',
    width: 220,
    marginBottom: 24,
  },
  cameraIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  cameraText: {
    color: '#007AFF',
    fontSize: 15,
    fontWeight: '600',
  },
  previewContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  preview: {
    width: 220,
    height: 220,
    borderRadius: 110,
    resizeMode: 'cover',
    borderWidth: 3,
    borderColor: '#007AFF',
  },
  retakeBtn: {
    marginTop: 12,
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
  error: {
    color: '#FF3B30',
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 13,
  },
  button: {
    backgroundColor: '#34C759',
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
    backgroundColor: '#34C759',
  },
});

export { SelfieScreen };
