import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuth } from '../hooks/useAuth';

export const HomeScreen: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <View style={styles.badge}>
        <Text style={styles.checkmark}>✓</Text>
      </View>

      <Text style={styles.title}>VERIFICADO</Text>
      <Text style={styles.subtitle}>Funcionalidades en desarrollo</Text>

      {user?.full_name ? (
        <Text style={styles.welcome}>Bienvenido, {user.full_name}</Text>
      ) : null}

      <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 24,
  },
  badge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#34C759',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkmark: {
    color: '#fff',
    fontSize: 52,
    fontWeight: 'bold',
    lineHeight: 56,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#34C759',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  welcome: {
    fontSize: 14,
    color: '#999',
    marginTop: 16,
  },
  logoutButton: {
    marginTop: 40,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  logoutText: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
});
