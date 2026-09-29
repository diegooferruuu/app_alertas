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
import { prepararParaEnviar } from '../../services/imagenes';

const IDPhotoScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { extraerDatosDocumento, isLoading } = useAuthStore();
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Única vía de captura del carnet: la cámara, en el momento.
   *
   * No hay opción de galería a propósito. Elegir una imagen ya guardada es el
   * camino fácil para registrar el documento de otra persona —una foto recibida
   * por mensajería, una descargada— y quitarlo cierra ese caso sin pedirle nada
   * a quien sí tiene su carnet en la mano.
   *
   * **Esto no prueba que la foto sea real.** El cliente corre en un teléfono
   * ajeno: una aplicación modificada envía lo que quiera, y quien se lo proponga
   * fotografía una pantalla. Es fricción contra el caso casual, no una garantía;
   * la garantía del sistema sigue siendo la atribución posterior, no esta
   * comprobación. Escribirlo aquí para que nadie lo lea como más de lo que es.
   *
   * La selfie ya funcionaba así; el carnet era la incoherencia.
   */
  const takePhoto = async (side: 'front' | 'back') => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permiso requerido',
          'La foto del carnet debe tomarse ahora, así que necesitamos acceso a tu cámara.',
        );
        return;
      }
    }

    setLoading(true);
    try {
      // En web esto solo marca `capture` en un `<input type="file">`, que los
      // navegadores de escritorio ignoran: allí la restricción no se sostiene y
      // se degrada a un selector de archivos. En iOS y Android sí abre la cámara.
      const result = await ImagePicker.launchCameraAsync({
        // El carnet se fotografía con la cámara trasera; la delantera es para la
        // selfie.
        cameraType: ImagePicker.CameraType.back,
        quality: 0.8,
        allowsEditing: false,
      });

      if (!result.canceled) {
        const { uri, width } = result.assets[0];
        const base64 = await prepararParaEnviar(uri, width);
        if (side === 'front') setFrontImage(base64);
        else setBackImage(base64);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNext = async () => {
    if (!frontImage || !backImage) {
      Alert.alert('Fotos requeridas', 'Falta fotografiar el anverso o el reverso de tu carnet.');
      return;
    }

    try {
      // Valida calidad de imagen + coincidencia de datos contra el OCR del backend
      await extraerDatosDocumento(frontImage, backImage);
      navigation.navigate('Selfie');
    } catch (err: any) {
      Alert.alert(
        'No se pudieron leer los datos',
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
        Fotografía el anverso y el reverso de tu carnet de identidad. Las fotos se
        toman ahora con la cámara: no se pueden elegir de la galería.
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
            <TouchableOpacity style={styles.retakeBtn} onPress={() => takePhoto('front')}>
              <Text style={styles.retakeBtnText}>Repetir foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadBox} onPress={() => takePhoto('front')}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>Fotografiar anverso</Text>
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
            <TouchableOpacity style={styles.retakeBtn} onPress={() => takePhoto('back')}>
              <Text style={styles.retakeBtnText}>Repetir foto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadBox} onPress={() => takePhoto('back')}>
            <Text style={styles.uploadIcon}>📷</Text>
            <Text style={styles.uploadText}>Fotografiar reverso</Text>
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
