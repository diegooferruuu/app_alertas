import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import desactivacionService, {
  DenunciaQueMeIdentifica,
} from '../../services/desactivacion.service';

/**
 * El interruptor de desactivación, del lado de la persona reportada.
 *
 * Es la garantía que sostiene el resto del diseño: el sistema no comprueba que
 * una denuncia sea cierta, pero quien es reportado puede detenerla. Hasta ahora
 * esa garantía existía solo en la API.
 *
 * Deliberadamente no muestra nada de quien denunció. Ver el detalle del porqué
 * en `desactivacion.service.ts`.
 */
const AlertasSobreMiScreen: React.FC<{ navigation: any }> = () => {
  const [alertas, setAlertas] = useState<DenunciaQueMeIdentifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retirando, setRetirando] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAlertas(await desactivacionService.misAlertas());
    } catch {
      // Se deja la lista como está: un fallo de red no debe dar a entender que
      // no hay ninguna alerta cuando puede haberla.
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const retirar = async (alerta: DenunciaQueMeIdentifica) => {
    setRetirando(alerta.id);
    try {
      const resultado = await desactivacionService.desactivar(alerta.id);
      await load();
      Alert.alert('Alerta retirada', resultado.mensaje);
    } catch (err: any) {
      Alert.alert(
        'No se pudo retirar',
        err?.response?.data?.message ||
          'No se pudo retirar la alerta. Inténtalo de nuevo.',
      );
    } finally {
      setRetirando(null);
    }
  };

  const confirmarRetiro = (alerta: DenunciaQueMeIdentifica) => {
    Alert.alert(
      '¿Retirar esta alerta?',
      'Dejará de difundirse de inmediato y no podrá volver a activarse. ' +
        'La denuncia queda registrada, y podrás solicitar después una constancia ' +
        'con la identidad de quien la firmó.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Retirar',
          style: 'destructive',
          onPress: () => retirar(alerta),
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <FlatList
      data={alertas}
      keyExtractor={(item) => item.id}
      contentContainerStyle={alertas.length === 0 ? styles.empty : styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
        />
      }
      ListHeaderComponent={
        alertas.length > 0 ? (
          <Text style={styles.intro}>
            Estas denuncias te identifican por tu documento. Si estás bien, puedes
            retirarlas y dejarán de alertar a tu zona.
          </Text>
        ) : null
      }
      ListEmptyComponent={
        <View style={styles.emptyBox}>
          <Ionicons name="shield-checkmark-outline" size={56} color="#34C759" />
          <Text style={styles.emptyTitle}>Ninguna alerta te identifica</Text>
          <Text style={styles.emptyText}>
            No existe ninguna denuncia activa asociada a tu documento.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View
            style={[
              styles.badge,
              {
                backgroundColor: item.se_esta_difundiendo ? '#FAE5E3' : '#EFEFF0',
              },
            ]}
          >
            <Ionicons
              name={item.se_esta_difundiendo ? 'radio' : 'pause-circle-outline'}
              size={14}
              color={item.se_esta_difundiendo ? '#B32C24' : '#8E8E93'}
            />
            <Text
              style={[
                styles.badgeText,
                { color: item.se_esta_difundiendo ? '#B32C24' : '#8E8E93' },
              ]}
            >
              {item.se_esta_difundiendo
                ? 'Se está alertando a tu zona'
                : 'No se está difundiendo'}
            </Text>
          </View>

          <Text style={styles.name}>
            {item.nombre_persona_buscada || 'Sin nombre'}
          </Text>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.fecha}>
            Presentada el {new Date(item.created_at).toLocaleDateString()}
          </Text>

          {/* Una caducada puede revivir si alguien la corrobora tarde, así que
              también se puede retirar: por eso el botón no depende de que se
              esté difundiendo ahora mismo. */}
          <TouchableOpacity
            style={styles.retirarButton}
            onPress={() => confirmarRetiro(item)}
            disabled={retirando !== null}
          >
            {retirando === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="hand-left-outline" size={18} color="#fff" />
                <Text style={styles.retirarText}>Retirar esta alerta</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  empty: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyBox: { alignItems: 'center', gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', marginTop: 6 },
  emptyText: { color: '#888', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  intro: { fontSize: 14, color: '#555', lineHeight: 20, marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 10,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
  description: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 10 },
  fecha: { fontSize: 12, color: '#999', marginBottom: 16 },
  retirarButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#B32C24',
  },
  retirarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export { AlertasSobreMiScreen };
