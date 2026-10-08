import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import cierreService from '../../services/cierre.service';
import sancionesService, {
  SituacionSanciones,
  presentacionDe,
} from '../../services/sanciones.service';

const ProfileScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { user, documentoRegistrado, logout } = useAuth();
  const [alertasSobreMi, setAlertasSobreMi] = useState(0);
  const [situacion, setSituacion] = useState<SituacionSanciones | null>(null);

  // El cierre tiene que ser encontrable sin depender de la notificación: quien
  // reinstala la app, o desactiva los avisos, no deja de estar reportado por
  // eso. El contador es lo que lo hace visible.
  //
  // La situación se pide aquí por la misma razón que el contador: una cuenta
  // sancionada recibe un rechazo al denunciar o firmar, y tiene que poder
  // enterarse de por qué sin esperar a encontrárselo.
  useFocusEffect(
    useCallback(() => {
      if (!documentoRegistrado) {
        setAlertasSobreMi(0);
        setSituacion(null);
        return;
      }
      cierreService
        .misAlertas()
        .then((a) => setAlertasSobreMi(a.filter((d) => d.puede_cerrarse).length))
        .catch(() => setAlertasSobreMi(0));
      sancionesService
        .miSituacion()
        .then(setSituacion)
        // Sin respuesta no se muestra nada: callar es mejor que decir «sin
        // faltas» de una cuenta que podría tenerlas.
        .catch(() => setSituacion(null));
    }, [documentoRegistrado]),
  );

  const presentacion = situacion ? presentacionDe(situacion) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
          {user?.full_name?.charAt(0).toUpperCase() || '?'}
        </Text>
      </View>

      <Text style={styles.name}>{user?.full_name || 'Usuario'}</Text>
      <Text style={styles.email}>{user?.email}</Text>

      {documentoRegistrado ? (
        <View style={[styles.badge, { backgroundColor: '#E2F2EA' }]}>
          <Ionicons name="checkmark-circle" size={15} color="#0E7247" />
          <Text style={[styles.badgeLabel, { color: '#0E7247' }]}>Documento registrado</Text>
        </View>
      ) : (
        <>
          <View style={[styles.badge, { backgroundColor: '#FFF1DE' }]}>
            <Ionicons name="person-circle-outline" size={15} color="#8F5600" />
            <Text style={[styles.badgeLabel, { color: '#8F5600' }]}>Visitante</Text>
          </View>
          <Text style={styles.badgeDesc}>
            Puedes ver el mapa y la lista. Registra tu documento para reportar.
          </Text>
        </>
      )}

      {/* Solo cuando hay algo que contar: «sin faltas» queda dentro de «Mi
          situación», no ocupa el perfil. */}
      {situacion && presentacion && situacion.estado !== 'NORMAL' && (
        <TouchableOpacity
          style={[
            styles.sancion,
            { backgroundColor: presentacion.fondo, borderColor: `${presentacion.color}40` },
          ]}
          onPress={() => navigation.navigate('MiSituacion')}
        >
          <Ionicons name={presentacion.icono as any} size={20} color={presentacion.color} />
          <View style={styles.sancionBody}>
            <Text style={[styles.sancionTitulo, { color: presentacion.color }]}>
              {presentacion.titulo}
            </Text>
            <Text style={styles.sancionDetalle}>{presentacion.detalle}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={presentacion.color} />
        </TouchableOpacity>
      )}

      <View style={styles.menu}>
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

        {documentoRegistrado && (
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('MiSituacion')}
          >
            <Ionicons name="scale-outline" size={20} color="#007AFF" />
            <Text style={styles.menuItemText}>Mi situación</Text>
            {presentacion && (
              <Text style={[styles.menuEstado, { color: presentacion.color }]}>
                {presentacion.titulo}
              </Text>
            )}
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        )}
      </View>

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
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 8,
  },
  badgeLabel: { fontSize: 14, fontWeight: '700' },
  badgeDesc: {
    fontSize: 13,
    color: '#777',
    textAlign: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  sancion: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 12,
  },
  sancionBody: { flex: 1 },
  sancionTitulo: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  sancionDetalle: { fontSize: 13, color: '#555', lineHeight: 19 },
  menu: { width: '100%', gap: 14, marginTop: 24, marginBottom: 14 },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    backgroundColor: '#f7f7f7',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  menuItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  menuEstado: { fontSize: 13, fontWeight: '600' },
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
