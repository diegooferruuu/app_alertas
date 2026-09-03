import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import desactivacionService from '../../services/desactivacion.service';

const getRoleInfo = (
  role: string | undefined,
  documentoRegistrado: boolean,
): { label: string; color: string; desc: string } => {
  if (role === 'moderator') {
    return {
      label: 'Moderador',
      color: '#AF52DE',
      desc: 'Puedes señalar denuncias presuntamente falsas.',
    };
  }
  if (documentoRegistrado) {
    return {
      label: 'Ciudadano',
      color: '#34C759',
      desc: 'Puedes reportar denuncias, calificar y recibir alertas.',
    };
  }
  return {
    label: 'Visitante',
    color: '#FF9500',
    desc: 'Puedes ver el mapa y la lista. Registra tu documento para reportar.',
  };
};

const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, documentoRegistrado, logout } = useAuth();
  const roleInfo = getRoleInfo(user?.role, documentoRegistrado);
  const [alertasSobreMi, setAlertasSobreMi] = useState(0);

  // El interruptor tiene que ser encontrable sin depender de la notificación:
  // quien reinstala la app, o desactiva los avisos, no dejaría de estar
  // reportado por eso. El contador es lo que lo hace visible.
  useFocusEffect(
    useCallback(() => {
      if (!documentoRegistrado) {
        setAlertasSobreMi(0);
        return;
      }
      desactivacionService
        .misAlertas()
        .then((a) => setAlertasSobreMi(a.length))
        .catch(() => setAlertasSobreMi(0));
    }, [documentoRegistrado]),
  );

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
            name={documentoRegistrado ? 'checkmark-circle' : 'close-circle'}
            size={28}
            color={documentoRegistrado ? '#34C759' : '#FF3B30'}
          />
          <Text style={styles.statLabel}>Documento</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.menuItem}
        onPress={() => navigation.navigate('MisDenuncias')}
      >
        <Ionicons name="document-text-outline" size={20} color="#007AFF" />
        <Text style={styles.menuItemText}>Mis denuncias</Text>
        <Ionicons name="chevron-forward" size={18} color="#ccc" />
      </TouchableOpacity>

      {documentoRegistrado && (
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => navigation.navigate('AlertasSobreMi')}
        >
          <Ionicons
            name="shield-outline"
            size={20}
            color={alertasSobreMi > 0 ? '#B32C24' : '#007AFF'}
          />
          <Text style={styles.menuItemText}>Alertas sobre mí</Text>
          {alertasSobreMi > 0 && (
            <View style={styles.contador}>
              <Text style={styles.contadorText}>{alertasSobreMi}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color="#ccc" />
        </TouchableOpacity>
      )}

      {!documentoRegistrado && (
        <TouchableOpacity
          style={styles.verifyButton}
          onPress={() => navigation.navigate('PersonalData')}
        >
          <Ionicons name="shield-checkmark" size={18} color="#fff" />
          <Text style={styles.verifyButtonText}>Registrar mi documento</Text>
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
  contador: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: '#B32C24',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contadorText: { color: '#fff', fontSize: 12, fontWeight: '700' },
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
