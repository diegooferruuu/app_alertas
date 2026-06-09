import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../../store/auth.store';

const VerifyIdentityScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { verifyIdentity, isLoading, error } = useAuthStore();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const base64 = e.target.result.split(',')[1];
      setCapturedImage(base64);
    };
    reader.readAsDataURL(file);
  };

  const pickImage = async () => {
    if (Platform.OS === 'web') {
      fileInputRef.current?.click();
    }
  };

  const handleVerification = async () => {
    if (!capturedImage) {
      Alert.alert('Error', 'Please capture or select an ID card image');
      return;
    }

    try {
      await verifyIdentity(capturedImage);
      Alert.alert('Success', 'Identity verified successfully!');
      navigation.navigate('Home');
    } catch (error) {
      Alert.alert('Verification Failed', (error as any).message || 'An error occurred');
    }
  };

  if (capturedImage) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Verify ID Card</Text>
        <Image
          source={{ uri: `data:image/jpeg;base64,${capturedImage}` }}
          style={styles.preview}
        />
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleVerification}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Verify Identity</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => setCapturedImage(null)}
          disabled={isLoading}
        >
          <Text style={styles.secondaryButtonText}>Retake Photo</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Web version with file upload
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.webContent}>
          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>
            Upload a photo of your ID card to complete the verification process
          </Text>
          <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
            <Text style={styles.uploadButtonText}>📤 Choose ID Card Photo</Text>
          </TouchableOpacity>
          <input
            ref={fileInputRef as any}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      </View>
    );
  }

  // Native version (fallback)
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Identity</Text>
      <Text style={styles.message}>Upload a photo of your ID card</Text>
      <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
        <Text style={styles.uploadButtonText}>📤 Choose ID Card Photo</Text>
      </TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  preview: {
    width: 300,
    height: 200,
    marginBottom: 20,
    borderRadius: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  secondaryButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: '#34C759',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  message: {
    fontSize: 16,
    marginBottom: 20,
    color: '#666',
    textAlign: 'center',
  },
  error: {
    color: '#FF3B30',
    marginBottom: 15,
    textAlign: 'center',
    marginTop: 10,
  },
});

export { VerifyIdentityScreen };
