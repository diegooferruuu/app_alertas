import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import { declaracionService, Vinculo } from '../../services/denuncia.service';

/**
 * Normaliza igual que el servidor, para que el botón se habilite exactamente
 * cuando la firma va a ser aceptada.
 *
 * Es una comodidad de la interfaz, no un control: la comprobación que cuenta la
 * hace el servidor, que es quien sella el registro.
 */
const normalizar = (valor: string): string =>
  valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const FirmarDeclaracionScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { denunciaId, versionId, modo = 'firmar' } = route.params;
  const esCorroboracion = modo === 'corroborar';
  const { user } = useAuth();

  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [vinculo, setVinculo] = useState<string | null>(null);
  const [nombreEscrito, setNombreEscrito] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setVinculos(await declaracionService.vinculos());
      } catch {
        Alert.alert('Error', 'No se pudieron cargar los vínculos.');
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const nombreRegistrado = user?.full_name ?? '';
  const nombreCoincide =
    normalizar(nombreEscrito).length > 0 &&
    normalizar(nombreEscrito) === normalizar(nombreRegistrado);
  const puedeFirmar = Boolean(vinculo) && nombreCoincide && !enviando;

  const firmar = async () => {
    setEnviando(true);
    try {
      const payload = {
        version_texto_legal_id: versionId,
        vinculo_declarado: vinculo!,
        nombre_escrito: nombreEscrito,
      };

      if (esCorroboracion) {
        await declaracionService.corroborar(denunciaId, payload);
        Alert.alert(
          'Declaración firmada',
          'Corroboraste esta denuncia. La alerta pasa a difundirse en una zona más amplia y por más tiempo.',
          [{ text: 'Entendido', onPress: () => navigation.navigate('MainTabs') }],
        );
      } else {
        await declaracionService.firmar(denunciaId, payload);
        Alert.alert(
          'Declaración firmada',
          'Tu denuncia empezó a difundirse en la zona. La alerta caducará sola si nadie la corrobora.',
          [{ text: 'Entendido', onPress: () => navigation.navigate('MainTabs') }],
        );
      }
    } catch (err: any) {
      Alert.alert(
        'No se pudo firmar',
        err?.response?.data?.message || 'Intenta de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = () => {
    const etiqueta =
      vinculos.find((v) => v.valor === vinculo)?.etiqueta ?? 'la persona';
    Alert.alert(
      esCorroboracion ? '¿Corroborar esta denuncia?' : '¿Firmar la declaración?',
      esCorroboracion
        ? `Declaras bajo juramento ser ${etiqueta} de la persona buscada.\n\nCorroborar compromete igual que denunciar: tu identidad queda asociada de forma permanente a esta denuncia, y la alerta ampliará su alcance.`
        : `Declaras bajo juramento ser ${etiqueta} de la persona que reportas.\n\nTu identidad quedará asociada de forma permanente a esta denuncia y la alerta empezará a difundirse.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: esCorroboracion ? 'Corroborar' : 'Firmar',
          style: 'destructive',
          onPress: firmar,
        },
      ],
    );
  };

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.contenedor}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.titulo}>
        {esCorroboracion ? 'Corroborar la denuncia' : 'Firmar la declaración'}
      </Text>

      <Text style={styles.etiqueta}>¿Qué eres de la persona desaparecida?</Text>
      <View style={styles.opciones}>
        {vinculos.map((v) => {
          const elegido = vinculo === v.valor;
          return (
            <TouchableOpacity
              key={v.valor}
              style={[styles.opcion, elegido && styles.opcionElegida]}
              onPress={() => setVinculo(v.valor)}
            >
              <Ionicons
                name={elegido ? 'radio-button-on' : 'radio-button-off'}
                size={20}
                color={elegido ? '#007AFF' : '#bbb'}
              />
              <Text style={[styles.opcionTexto, elegido && styles.opcionTextoElegido]}>
                {v.etiqueta}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.etiqueta}>Escribe tu nombre completo</Text>
      <Text style={styles.ayuda}>
        Tal como figura en tu documento registrado. Escríbelo a mano: no se puede
        pegar ni autocompletar.
      </Text>
      <TextInput
        style={[
          styles.campo,
          nombreEscrito.length > 0 &&
            (nombreCoincide ? styles.campoValido : styles.campoInvalido),
        ]}
        value={nombreEscrito}
        onChangeText={setNombreEscrito}
        placeholder="Tu nombre completo"
        autoCapitalize="words"
        autoCorrect={false}
        autoComplete="off"
        textContentType="none"
        importantForAutofill="no"
        spellCheck={false}
        // Impide pegar: el acto tiene que ser deliberado, y copiar el nombre de
        // otra pantalla vaciaría de sentido la comprobación.
        contextMenuHidden
        selectTextOnFocus={false}
      />

      {nombreEscrito.length > 0 && !nombreCoincide && (
        <Text style={styles.error}>
          Aún no coincide con el nombre de tu documento.
        </Text>
      )}

      <TouchableOpacity
        style={[styles.boton, !puedeFirmar && styles.botonDeshabilitado]}
        disabled={!puedeFirmar}
        onPress={confirmar}
      >
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>
            {esCorroboracion ? 'Corroborar bajo juramento' : 'Firmar declaración jurada'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.pasos}>
        <View style={styles.paso} />
        <View style={[styles.paso, styles.pasoActivo]} />
        <View style={[styles.paso, styles.pasoActivo]} />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  contenedor: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 20 },
  etiqueta: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 6 },
  ayuda: { fontSize: 13, color: '#777', marginBottom: 10, lineHeight: 18 },
  opciones: { gap: 4 },
  opcion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  opcionElegida: { borderColor: '#007AFF', backgroundColor: '#F0F6FF' },
  opcionTexto: { fontSize: 15, color: '#444' },
  opcionTextoElegido: { color: '#1B44BB', fontWeight: '600' },
  campo: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  campoValido: { borderColor: '#0E7247', backgroundColor: '#F2FAF6' },
  campoInvalido: { borderColor: '#E0A0A0' },
  error: { color: '#B32C24', fontSize: 13, marginTop: 8 },
  boton: {
    backgroundColor: '#B32C24',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  botonDeshabilitado: { backgroundColor: '#c3c9d6' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pasos: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 24 },
  paso: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ddd' },
  pasoActivo: { backgroundColor: '#007AFF' },
});

export { FirmarDeclaracionScreen };
