import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';

const getRoleInfo = (
  role: string | undefined,
  verified: boolean,
): { label: string; color: string; desc: string } => {
  if (role === 'moderator') {
    return {
      label: 'Moderador',
      color: '#AF52DE',
      desc: 'Puedes moderar incidentes y la comunidad.',
    };
  }
  if (verified) {
    return {
      label: 'Ciudadano',
      color: '#34C759',
      desc: 'Puedes reportar incidentes, calificar y recibir notificaciones.',
    };
  }
  return {
    label: 'Visitante',
    color: '#FF9500',
    desc: 'Puedes ver el mapa y la lista. Verifícate para reportar.',
  };
};

const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, identityVerified, logout } = useAuth();
  const roleInfo = getRoleInfo(user?.role, identityVerified);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.full_name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>

      <Text style={styles.name}>{user?.full_name || 'Usuario'}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      <View style={[styles.roleBadge, { backgroundColor: `${roleInfo.color}20` }]}>
        <Text style={[styles.roleLabel, { color: roleInfo.color }]}>{roleInfo.label}</Text>
      </View>
      <Text style={styles.roleDesc}>{roleInfo.desc}</Text>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{user?.reputation_score ?? '—'}</Text>
          <Text style={styles.statLabel}>Reputación</Text>
        </View>
        <View style={styles.statCard}>
          <Ionicons
            name={identityVerified ? 'checkmark-circle' : 'close-circle'}
            size={28}
            color={identityVerified ? '#34C759' : '#FF3B30'}
          />
          <Text style={styles.statLabel}>Verificado</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('MyIncidents')}
      >
        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
        <Text style={styles.menuItemText}>Mis denuncias</Text>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>

      {!identityVerified && (
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={() => navigation.navigate('PersonalData')}
        >
          <Ionicons name="shield-checkmark" size={18} color="#fff" />
          <Text style={styles.verifyButtonText}>Verificar mi identidad</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
        <Ionicons name="log-out-outline" size={18} color="#FF3B30" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', alignItems: 'center', flexGrow: 1 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: 'bold' },
  name: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  email: { fontSize: 14, color: '#666', marginBottom: 16 },
  roleBadge: { paddingVertical: 6, paddingHorizontal: 18, borderRadius: 20, marginBottom: 8 },
  roleLabel: { fontSize: 15, fontWeight: '700' },
  roleDesc: { fontSize: 13, color: '#777', textAlign: 'center', marginBottom: 24, paddingHorizontal: 12 },
  statsRow: { flexDirection: 'row', gap: 16, marginBottom: 28 },
  statCard: {
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  statLabel: { fontSize: 12, color: '#888', marginTop: 4 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  verifyButton: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#34C759',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 14,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  logoutButton: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutText: { color: '#FF3B30', fontSize: 15, fontWeight: '600' },
});

export { ProfileScreen };
