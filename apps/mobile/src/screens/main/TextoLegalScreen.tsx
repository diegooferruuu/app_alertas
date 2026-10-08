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
import { SelectorCerrado } from '../../components/SelectorCerrado';
import { declaracionService, TextoLegal, Vinculo } from '../../services/denuncia.service';
import { conMayuscula, partesDelTexto } from '../../utils/texto-legal';

/**
 * Primer paso de la declaración jurada: decir qué se es de la persona y leer el
 * texto legal.
 *
 * El vínculo se elige **antes** de leer, porque el texto lo nombra: «Declaro
 * bajo juramento ser madre de la persona…». Leer un marcador en su lugar era
 * leer una declaración incompleta, y firmar después algo que no se vio entero.
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
  const { denunciaId } = route.params;
  const [textoLegal, setTextoLegal] = useState<TextoLegal | null>(null);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [vinculo, setVinculo] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leidoHastaElFinal, setLeidoHastaElFinal] = useState(false);
  const [alturaVisible, setAlturaVisible] = useState(0);
  const yaLlegoAlFinal = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        // Los vínculos los sirve el servidor, con la forma en que van dentro
        // de la frase: la app no mantiene su propia lista.
        const [texto, lista] = await Promise.all([
          declaracionService.textoLegal(),
          declaracionService.vinculos(),
        ]);
        setTextoLegal(texto);
        setVinculos(lista);
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

  // La etiqueta tal como va dentro de la frase («madre», «hijo o hija»).
  const etiqueta = vinculos.find((v) => v.valor === vinculo)?.etiqueta ?? null;
  const partes = partesDelTexto(textoLegal.texto);
  const puedeContinuar = Boolean(etiqueta) && leidoHastaElFinal;

  return (
    <View style={styles.contenedor}>
      <View style={styles.encabezado}>
        <Text style={styles.titulo}>Declaración jurada</Text>
        <Text style={styles.subtitulo}>
          Indica qué eres de la persona desaparecida y lee el texto completo. Al
          firmarlo, tu identidad queda asociada de forma permanente a esta denuncia.
        </Text>
      </View>

      <SelectorCerrado
        etiqueta="¿Qué eres de la persona desaparecida?"
        opciones={vinculos.map((v) => ({ valor: v.valor, etiqueta: conMayuscula(v.etiqueta) }))}
        valor={vinculo}
        onChange={setVinculo}
        ayuda="Si no eres familiar, la alerta llega a una zona más chica y dura menos."
      />

      <ScrollView
        style={styles.marcoTexto}
        contentContainerStyle={styles.contenidoTexto}
        onScroll={alDesplazar}
        scrollEventThrottle={100}
        onContentSizeChange={alMedirContenido}
        onLayout={(e) => setAlturaVisible(e.nativeEvent.layout.height)}
      >
        {/* El vínculo va resaltado: es lo que la persona declara, con sus
            palabras. Mientras no lo elija, queda un espacio en blanco visible. */}
        <Text style={styles.texto}>
          {partes.map((parte, i) => (
            <React.Fragment key={i}>
              {parte}
              {i < partes.length - 1 && (
                <Text style={etiqueta ? styles.vinculo : styles.vinculoPendiente}>
                  {etiqueta ?? '__________'}
                </Text>
              )}
            </React.Fragment>
          ))}
        </Text>
        <Text style={styles.version}>Versión {textoLegal.version}</Text>
      </ScrollView>

      {!puedeContinuar && (
        <View style={styles.aviso}>
          <Ionicons
            name={etiqueta ? 'arrow-down-circle-outline' : 'help-circle-outline'}
            size={16}
            color="#8F5600"
          />
          <Text style={styles.avisoTexto}>
            {etiqueta
              ? 'Desplázate hasta el final para poder continuar'
              : 'Elige qué eres de la persona para poder continuar'}
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.boton, !puedeContinuar && styles.botonDeshabilitado]}
        disabled={!puedeContinuar}
        onPress={() =>
          navigation.navigate('FirmarDeclaracion', {
            denunciaId,
            versionId: textoLegal.version_id,
            hashTextoLegal: textoLegal.hash_texto,
            vinculo,
            etiquetaVinculo: etiqueta,
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
  vinculo: { fontWeight: '700', color: '#1B44BB' },
  vinculoPendiente: { color: '#8F5600', fontWeight: '700' },
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
