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
import { resumenDescriptivo } from './catalogo-denuncia';
import { useFocusEffect } from '@react-navigation/native';
import cierreService, { DenunciaQueMeIdentifica } from '../../services/cierre.service';
import constanciaService from '../../services/constancia.service';

/** Cómo se le presenta a la persona el estado de una denuncia que la identifica. */
const situacionDe = (d: DenunciaQueMeIdentifica) => {
  if (d.estado === 'CERRADA') {
    return {
      etiqueta: 'Terminada por quien la presentó',
      icono: 'checkmark-done-outline',
      color: '#0E7247',
      fondo: '#E2F2EA',
    };
  }
  if (d.estado === 'INVALIDADA') {
    return {
      etiqueta: 'Cerrada por ti',
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
 * Las alertas que identifican a la persona, y la puerta para cerrarlas.
 *
 * Es la garantía que sostiene el resto del diseño: el sistema no comprueba que
 * una denuncia sea cierta, pero quien es reportado puede detenerla. El cierre
 * en sí —«Estoy bien» o «Esta denuncia es falsa»— vive en su propia pantalla.
 *
 * Deliberadamente no muestra nada de quien denunció. Ver el detalle del porqué
 * en `cierre.service.ts`.
 */
const AlertasSobreMiScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [alertas, setAlertas] = useState<DenunciaQueMeIdentifica[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [pidiendo, setPidiendo] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setAlertas(await cierreService.misAlertas());
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
            Estas denuncias te identifican por tu documento. Si estás bien, o si la
            denuncia es falsa, puedes cerrarlas y dejarán de alertar a tu zona.
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
          <Text style={styles.description}>{resumenDescriptivo(item)}</Text>
          <Text style={styles.fecha}>
            Presentada el {new Date(item.created_at).toLocaleDateString()}
          </Text>

          {/* Una caducada puede revivir si se registra tarde el caso de la
              FELCC, así que también se puede cerrar: por eso el botón no
              depende de que se esté difundiendo ahora mismo. Una ya cerrada no
              reaparece aquí como accionable —INVALIDADA es terminal— pero sigue
              en la lista porque su constancia no caduca. */}
          {/* Una que quien la presentó ya dio por terminada no se difunde,
              pero la persona todavía puede responderla —y declararla falsa—:
              terminarla no puede ser la forma de escapar de la falta. */}
          {item.puede_cerrarse && (
            <TouchableOpacity
              style={styles.retirarButton}
              onPress={() => navigation.navigate('CerrarAlerta', { alerta: item })}
            >
              <Ionicons
                name={item.estado === 'CERRADA' ? 'chatbubble-ellipses-outline' : 'hand-left-outline'}
                size={18}
                color="#fff"
              />
              <Text style={styles.retirarText}>
                {item.estado === 'CERRADA' ? 'Responder a esta denuncia' : 'Cerrar esta alerta'}
              </Text>
            </TouchableOpacity>
          )}

          {/* La constancia solo existe si alguien firmó bajo juramento: una
              denuncia en REGISTRADA todavía no tiene declaración que mostrar. */}
          {item.nivel_confianza !== 'REGISTRADA' && (
            <TouchableOpacity
              style={[
                styles.constanciaButton,
                item.puede_cerrarse && styles.constanciaSecundario,
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
