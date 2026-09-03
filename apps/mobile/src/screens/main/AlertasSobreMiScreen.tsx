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
import constanciaService from '../../services/constancia.service';

/** Cómo se le presenta a la persona el estado de una denuncia que la identifica. */
const situacionDe = (d: DenunciaQueMeIdentifica) => {
  if (d.estado === 'INVALIDADA') {
    return {
      etiqueta: 'Retirada por ti',
      icono: 'checkmark-circle',
      color: '#0E7247',
      fondo: '#E2F2EA',
    };
  }
  if (d.se_esta_difundiendo) {
    return {
      etiqueta: 'Se está alertando a tu zona',
      icono: 'radio',
      color: '#B32C24',
      fondo: '#FAE5E3',
    };
  }
  return {
    etiqueta: 'No se está difundiendo',
    icono: 'pause-circle-outline',
    color: '#8E8E93',
    fondo: '#EFEFF0',
  };
};

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
const AlertasSobreMiScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [alertas, setAlertas] = useState<DenunciaQueMeIdentifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [retirando, setRetirando] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState<string | null>(null);

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

  const pedirConstancia = async (alerta: DenunciaQueMeIdentifica) => {
    setPidiendo(alerta.id);
    try {
      const constancia = await constanciaService.solicitar(alerta.id);
      navigation.navigate('Constancia', { constancia });
    } catch (err: any) {
      Alert.alert(
        'No se pudo obtener la constancia',
        err?.response?.data?.message || 'Inténtalo de nuevo.',
      );
    } finally {
      setPidiendo(null);
    }
  };

  const confirmarConstancia = (alerta: DenunciaQueMeIdentifica) => {
    Alert.alert(
      '¿Solicitar la constancia?',
      'Verás la identidad de quien firmó esta denuncia. Quien la presentó aceptó ' +
        'quedar identificado como condición para difundirla.\n\n' +
        'La solicitud queda registrada. No hace falta que expliques por qué la pides.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Solicitar', onPress: () => pedirConstancia(alerta) },
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
          {(() => {
            const estado = situacionDe(item);
            return (
              <View style={[styles.badge, { backgroundColor: estado.fondo }]}>
                <Ionicons name={estado.icono as any} size={14} color={estado.color} />
                <Text style={[styles.badgeText, { color: estado.color }]}>
                  {estado.etiqueta}
                </Text>
              </View>
            );
          })()}

          <Text style={styles.name}>
            {item.nombre_persona_buscada || 'Sin nombre'}
          </Text>
          <Text style={styles.description}>{item.description}</Text>
          <Text style={styles.fecha}>
            Presentada el {new Date(item.created_at).toLocaleDateString()}
          </Text>

          {/* Una caducada puede revivir si alguien la corrobora tarde, así que
              también se puede retirar: por eso el botón no depende de que se
              esté difundiendo ahora mismo. Una ya retirada no reaparece aquí
              como accionable —INVALIDADA es terminal— pero sigue en la lista
              porque su constancia no caduca. */}
          {item.puede_retirarse && (
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
          )}

          {/* La constancia solo existe si alguien firmó bajo juramento: una
              denuncia en REGISTRADA todavía no tiene declaración que mostrar. */}
          {item.nivel_confianza !== 'REGISTRADA' && (
            <TouchableOpacity
              style={[
                styles.constanciaButton,
                item.puede_retirarse && styles.constanciaSecundario,
              ]}
              onPress={() => confirmarConstancia(item)}
              disabled={pidiendo !== null}
            >
              {pidiendo === item.id ? (
                <ActivityIndicator size="small" color="#1B44BB" />
              ) : (
                <>
                  <Ionicons name="document-text-outline" size={18} color="#1B44BB" />
                  <Text style={styles.constanciaText}>Solicitar constancia</Text>
                </>
              )}
            </TouchableOpacity>
          )}
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
  constanciaButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F4FD8',
  },
  constanciaSecundario: { marginTop: 10 },
  constanciaText: { color: '#1B44BB', fontWeight: '600', fontSize: 15 },
});

export { AlertasSobreMiScreen };
