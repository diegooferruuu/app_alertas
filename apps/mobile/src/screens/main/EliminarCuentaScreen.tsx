import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/auth.store';
import { CampoContrasena } from '../../components/CampoContrasena';
import { API_URL } from '../../services/api';
import { paginaPublica } from '../../utils/sitio';
import { Formulario } from '../../components/Formulario';

/**
 * Eliminar la cuenta (lo exige Google Play).
 *
 * Es una pantalla y no un diálogo porque antes de confirmar hay que poder leer
 * qué se borra y qué no. Lo que se conserva no es poco —las denuncias firmadas
 * y las faltas—, y descubrirlo después sería engañar a la persona.
 *
 * Pide la contraseña aunque haya sesión: es lo único irreversible que se puede
 * hacer desde la app, y un teléfono desbloqueado en otras manos no debe bastar.
 */
export const EliminarCuentaScreen: React.FC = () => {
  const eliminarCuenta = useAuthStore((s) => s.eliminarCuenta);
  const [contrasena, setContrasena] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const eliminar = async () => {
    setEliminando(true);
    setError(null);
    try {
      // Al terminar se cierra la sesión y la app vuelve sola a la pantalla de
      // ingreso: no hay a dónde navegar.
      await eliminarCuenta(contrasena);
    } catch (err: any) {
      setError(
        err?.response?.status === 403
          ? 'La contraseña no es correcta.'
          : err?.response?.data?.message || 'No se pudo eliminar la cuenta. Intenta de nuevo.',
      );
      setEliminando(false);
    }
  };

  const confirmar = () =>
    Alert.alert(
      '¿Eliminar tu cuenta?',
      'No se puede deshacer. Tus alertas activas dejan de difundirse ahora.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: eliminar },
      ],
    );

  return (
    <Formulario contentContainerStyle={styles.container}>
      <Text style={styles.titulo}>Qué se borra</Text>
      <Text style={styles.parrafo}>
        Tu nombre, tu correo, tu teléfono, tu contraseña, tu ubicación y los datos de tus
        teléfonos para las notificaciones.
      </Text>

      <Text style={styles.titulo}>Qué se conserva</Text>
      <Text style={styles.parrafo}>
        El número de tu carnet, solo como hash; las denuncias que presentaste y las declaraciones
        juradas que firmaste; y tus faltas, si las tienes. Una denuncia firmada tiene que seguir
        siendo atribuible, y eliminar la cuenta no puede servir para evadir una sanción.
      </Text>
      <Text style={styles.parrafo}>
        Si más adelante te registras con el mismo carnet, recuperas esta cuenta con su historial.
      </Text>

      <TouchableOpacity
        onPress={() => Linking.openURL(paginaPublica(API_URL, 'eliminar-cuenta'))}
        accessibilityRole="link"
      >
        <Text style={styles.enlace}>Más detalle en la página de eliminación de cuenta</Text>
      </TouchableOpacity>

      <Text style={styles.etiqueta}>Confirma con tu contraseña</Text>
      <CampoContrasena
        clase="existente"
        placeholder="Contraseña"
        value={contrasena}
        onChangeText={(texto) => {
          setContrasena(texto);
          setError(null);
        }}
        editable={!eliminando}
      />
      {error ? (
        <View style={styles.error}>
          <Ionicons name="alert-circle-outline" size={16} color="#B32C24" />
          <Text style={styles.errorTexto}>{error}</Text>
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.boton, (!contrasena || eliminando) && styles.botonApagado]}
        disabled={!contrasena || eliminando}
        onPress={confirmar}
      >
        {eliminando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="trash-outline" size={18} color="#fff" />
            <Text style={styles.botonTexto}>Eliminar mi cuenta</Text>
          </>
        )}
      </TouchableOpacity>
    </Formulario>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1, gap: 8 },
  titulo: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 8 },
  parrafo: { fontSize: 14, color: '#444', lineHeight: 21 },
  enlace: { fontSize: 14, color: '#007AFF', fontWeight: '600', marginTop: 4, marginBottom: 16 },
  etiqueta: { fontSize: 13, fontWeight: '700', color: '#777', marginBottom: 2 },
  error: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  errorTexto: { flex: 1, fontSize: 13, color: '#B32C24' },
  boton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#B32C24',
    borderRadius: 12,
    paddingVertical: 15,
    marginTop: 12,
  },
  botonApagado: { backgroundColor: '#d9a7a3' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
