import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuth } from '../../hooks/useAuth';
import { CampoContrasena } from '../../components/CampoContrasena';

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  // El nombre se pide por partes y no como una sola línea. Un campo único admite
  // «Ana Q.» o el apellido en el lugar del nombre, y este nombre no es una
  // etiqueta: es la identidad a la que quedará atribuida una denuncia.
  const [primerNombre, setPrimerNombre] = useState('');
  const [segundoNombre, setSegundoNombre] = useState('');
  const [primerApellido, setPrimerApellido] = useState('');
  const [segundoApellido, setSegundoApellido] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [repetirPassword, setRepetirPassword] = useState('');
  const { register, isLoading, error } = useAuth();

  // Solo se avisa cuando ya hay algo escrito en la repetición: marcar el error
  // desde la primera tecla es regañar a alguien que aún está escribiendo.
  const contrasenasNoCoinciden =
    repetirPassword.length > 0 && password !== repetirPassword;

  const handleRegister = async () => {
    if (
      !primerNombre.trim() ||
      !primerApellido.trim() ||
      !segundoApellido.trim() ||
      !email ||
      !phone ||
      !password
    ) {
      Alert.alert(
        'Faltan datos',
        'Completa todos los campos. El segundo nombre es el único opcional.',
      );
      return;
    }

    if (password !== repetirPassword) {
      Alert.alert(
        'Las contraseñas no coinciden',
        'Revisa que las dos sean iguales. Puedes usar el ojito para verlas.',
      );
      return;
    }

    try {
      // El documento de identidad se registra después, cuando la persona vaya a
      // reportar: crear la cuenta no lo exige.
      await register({
        email,
        password,
        phone,
        primer_nombre: primerNombre.trim(),
        // Ausente es un dato, no una cadena vacía: mucha gente no tiene segundo
        // nombre, y el servidor distingue los dos casos.
        segundo_nombre: segundoNombre.trim() || undefined,
        primer_apellido: primerApellido.trim(),
        segundo_apellido: segundoApellido.trim(),
      });
    } catch (error: any) {
      Alert.alert(
        'No se pudo crear la cuenta',
        error?.response?.data?.message ||
          error?.message ||
          'Revisa tus datos e inténtalo de nuevo.',
      );
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Crear cuenta</Text>
      <Text style={styles.subtitle}>Alerta Temprana</Text>

      <Text style={styles.seccion}>Tu nombre</Text>
      <Text style={styles.ayuda}>
        Escríbelo como aparece en tu cédula de identidad.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Primer nombre"
        value={primerNombre}
        onChangeText={setPrimerNombre}
        editable={!isLoading}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="Segundo nombre (opcional)"
        value={segundoNombre}
        onChangeText={setSegundoNombre}
        editable={!isLoading}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="Primer apellido"
        value={primerApellido}
        onChangeText={setPrimerApellido}
        editable={!isLoading}
        autoCapitalize="words"
      />

      <TextInput
        style={styles.input}
        placeholder="Segundo apellido"
        value={segundoApellido}
        onChangeText={setSegundoApellido}
        editable={!isLoading}
        autoCapitalize="words"
      />

      <Text style={styles.seccion}>Tus datos de contacto</Text>

      <TextInput
        style={styles.input}
        placeholder="Correo electrónico"
        value={email}
        onChangeText={setEmail}
        editable={!isLoading}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="Teléfono"
        value={phone}
        onChangeText={setPhone}
        editable={!isLoading}
        keyboardType="phone-pad"
      />

      <Text style={styles.seccion}>Tu contraseña</Text>

      <CampoContrasena
        placeholder="Contraseña (mínimo 8 caracteres)"
        value={password}
        onChangeText={setPassword}
        editable={!isLoading}
        etiquetaVisibilidad="Mostrar u ocultar la contraseña"
      />

      <CampoContrasena
        placeholder="Repetir contraseña"
        value={repetirPassword}
        onChangeText={setRepetirPassword}
        editable={!isLoading}
        etiquetaVisibilidad="Mostrar u ocultar la repetición de la contraseña"
        style={contrasenasNoCoinciden ? styles.inputConError : undefined}
      />

      {contrasenasNoCoinciden && (
        <Text style={styles.error}>Las dos contraseñas no coinciden.</Text>
      )}

      <Text style={styles.info}>
        Debe incluir al menos una mayúscula, una minúscula y un número.
      </Text>

      {error && <Text style={styles.error}>{error}</Text>}

      <TouchableOpacity
        style={[styles.button, isLoading && styles.buttonDisabled]}
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Crear cuenta</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => navigation.navigate('Login')}
        disabled={isLoading}
      >
        <Text style={styles.link}>¿Ya tienes cuenta? Inicia sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
  },
  seccion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
    marginTop: 6,
  },
  ayuda: {
    color: '#666',
    fontSize: 12,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  inputConError: {
    borderColor: '#FF3B30',
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
    marginBottom: 30,
    fontSize: 14,
  },
  error: {
    color: '#FF3B30',
    marginBottom: 10,
    textAlign: 'center',
  },
  info: {
    color: '#666',
    fontSize: 12,
    marginBottom: 15,
    marginTop: -5,
  },
});
