import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { declaracionService, TextoLegal } from '../../services/denuncia.service';

/**
 * Primer paso de la declaración jurada: leer el texto legal.
 *
 * El botón de continuar permanece deshabilitado hasta que la persona llega al
 * final del texto. No es un obstáculo decorativo: todo el diseño del sistema se
 * apoya en que nadie pueda alegar después que no sabía lo que aceptaba, y una
 * casilla que se marca sin leer no sostiene esa afirmación.
 */
const TextoLegalScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  // `modo` distingue firmar la denuncia propia de corroborar la de otra
  // persona. La ceremonia es la misma —y el compromiso también—, así que
  // solo cambia a qué endpoint va al final.
  const { denunciaId, modo = 'firmar' } = route.params;
  const [textoLegal, setTextoLegal] = useState<TextoLegal | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leidoHastaElFinal, setLeidoHastaElFinal] = useState(false);
  const [alturaVisible, setAlturaVisible] = useState(0);
  const yaLlegoAlFinal = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        setTextoLegal(await declaracionService.textoLegal());
      } catch (err: any) {
        setError(
          err?.response?.data?.message ||
            'No se pudo cargar el texto de la declaración.',
        );
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  const alDesplazar = ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    // Margen de 24 px: exigir el píxel exacto del final vuelve el gesto
    // frustrante en pantallas pequeñas sin aportar nada.
    const alFinal =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;

    if (alFinal && !yaLlegoAlFinal.current) {
      yaLlegoAlFinal.current = true;
      setLeidoHastaElFinal(true);
    }
  };

  /**
   * Si el texto cabe entero en pantalla no habrá desplazamiento que detectar,
   * así que se habilita al medirlo. Sin esto el botón quedaría bloqueado para
   * siempre en pantallas grandes.
   */
  const alMedirContenido = (_ancho: number, alto: number) => {
    if (alturaVisible > 0 && alto <= alturaVisible && !yaLlegoAlFinal.current) {
      yaLlegoAlFinal.current = true;
      setLeidoHastaElFinal(true);
    }
  };

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (error || !textoLegal) {
    return (
      <View style={styles.centro}>
        <Ionicons name="alert-circle-outline" size={40} color="#B32C24" />
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Declaración jurada</Text>
        <Text style={styles.subtitulo}>
          Lee el texto completo antes de continuar. Al firmarlo, tu identidad
          queda asociada de forma permanente a esta denuncia.
        </Text>
      </View>

      <ScrollView
        style={styles.marcoTexto}
        contentContainerStyle={styles.contenidoTexto}
        onScroll={alDesplazar}
        scrollEventThrottle={100}
        onContentSizeChange={alMedirContenido}
        onLayout={(e) => setAlturaVisible(e.nativeEvent.layout.height)}
      >
        <Text style={styles.texto}>{textoLegal.texto}</Text>
        <Text style={styles.version}>Versión {textoLegal.version}</Text>
      </ScrollView>

      {!leidoHastaElFinal && (
        <View style={styles.aviso}>
          <Ionicons name="arrow-down-circle-outline" size={16} color="#8F5600" />
          <Text style={styles.avisoTexto}>
            Desplázate hasta el final para poder continuar
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.boton, !leidoHastaElFinal && styles.botonDeshabilitado]}
        disabled={!leidoHastaElFinal}
        onPress={() =>
          navigation.navigate('FirmarDeclaracion', {
            denunciaId,
            modo,
            versionId: textoLegal.version_id,
          })
        }
      >
        <Text style={styles.botonTexto}>He leído la declaración</Text>
      </TouchableOpacity>

      <View style={styles.pasos}>
        <View style={[styles.paso, styles.pasoActivo]} />
        <View style={styles.paso} />
        <View style={styles.paso} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: { flex: 1, backgroundColor: '#fff', padding: 20 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  error: { color: '#B32C24', textAlign: 'center', fontSize: 14 },
  encabezado: { marginBottom: 16 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#666', lineHeight: 20 },
  marcoTexto: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#fafafa',
  },
  contenidoTexto: { padding: 16 },
  texto: { fontSize: 14, color: '#222', lineHeight: 22 },
  version: { fontSize: 12, color: '#999', marginTop: 20, textAlign: 'right' },
  aviso: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F9EEDA',
    borderRadius: 8,
    padding: 10,
    marginTop: 12,
  },
  avisoTexto: { color: '#6B4300', fontSize: 13 },
  boton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  botonDeshabilitado: { backgroundColor: '#c3c9d6' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pasos: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginTop: 20 },
  paso: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#ddd' },
  pasoActivo: { backgroundColor: '#007AFF' },
});

export { TextoLegalScreen };
