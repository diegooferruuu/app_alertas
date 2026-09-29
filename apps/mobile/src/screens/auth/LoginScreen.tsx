import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { CampoContrasena } from '../../components/CampoContrasena';

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Faltan datos', 'Completa el correo y la contraseña.');
      return;
    }

    try {
      // Se recorta antes de enviar. Los teclados de los teléfonos añaden un
      // espacio al aceptar una sugerencia, y el servidor respondía
      // «Credenciales inválidas» —indistinguible de una contraseña equivocada—.
      // El servidor también lo normaliza; esto evita el viaje de ida y vuelta.
      await login(email.trim(), password);
    } catch (error: any) {
      // El servidor ya responde en español; se prefiere su mensaje al genérico.
      Alert.alert(
        'No se pudo iniciar sesión',
        error?.response?.data?.message ||
          error?.message ||
          'Revisa tus datos e inténtalo de nuevo.',
      );
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Alerta Temprana</Text>
      <Text style={styles.subtitle}>Iniciar sesión</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        editable={!isLoading}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      {/*
        Con ojito, igual que en el registro. No es solo comodidad: el campo
        anterior era un TextInput suelto sin declarar qué clase de contraseña
        contenía, y ahí el autorrelleno del sistema puede escribir un valor
        distinto del tecleado sin que se note. Poder ver lo escrito convierte un
        «credenciales inválidas» inexplicable en algo que se diagnostica solo.
      */}
      <CampoContrasena
        placeholder="Contraseña"
        value={password}
        onChangeText={setPassword}
        editable={!isLoading}
        clase="existente"
      />

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Iniciar sesión</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Register')}
        disabled={isLoading}
      >
        <Text style={styles.link}>¿No tienes cuenta? Crea una</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  link: {
    color: '#007AFF',
    textAlign: 'center',
    marginTop: 15,
    fontSize: 14,
  },
  error: {
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
  },
});
