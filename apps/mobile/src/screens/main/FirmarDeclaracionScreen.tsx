import React, { useEffect, useRef, useState } from 'react';
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
import { rechazoDe } from '../../services/restricciones';
import { FirmaNoAutorizada, firmarConElTelefono } from '../../services/firma-dispositivo';

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
  // `hashTextoLegal`: el del texto que se leyó en la pantalla anterior. Entra en
  // lo que firma el teléfono.
  const { denunciaId, versionId, hashTextoLegal } = route.params;
  const { user } = useAuth();

  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [vinculo, setVinculo] = useState<string | null>(null);
  const [nombreEscrito, setNombreEscrito] = useState('');
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  /**
   * Lleva el campo del nombre por encima del teclado al enfocarlo.
   *
   * `automaticallyAdjustKeyboardInsets` deja sitio para desplazarse, pero quién
   * desplaza y cuándo lo decide UIKit. Esto lo hace explícito: el campo es lo
   * último de la pantalla, así que ir al final lo sube junto con el aviso de si
   * el nombre coincide y el botón de firmar, que es todo lo que hace falta ver.
   *
   * El retardo espera a que el teclado termine de aparecer; sin él se
   * desplazaría contra la altura de antes y se quedaría corto.
   */
  const subirCampo = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 250);
  };

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
      // El teléfono firma lo declarado: el contenido sellado que le entrega el
      // servidor, el texto legal que se leyó, el vínculo y el nombre escrito.
      // Antes pide el desbloqueo del teléfono; sin él no hay firma.
      const { hash_contenido_denuncia } = await declaracionService.contenidoAFirmar(denunciaId);
      const firma = await firmarConElTelefono(user!.id, {
        denuncia_id: denunciaId,
        hash_contenido_denuncia,
        hash_texto_legal: hashTextoLegal,
        vinculo_declarado: vinculo!,
        texto_firmado: nombreEscrito,
      });

      const { nivel_confianza } = await declaracionService.firmar(denunciaId, {
        version_texto_legal_id: versionId,
        vinculo_declarado: vinculo!,
        nombre_escrito: nombreEscrito,
        ...firma,
      });
      Alert.alert(
        'Declaración firmada',
        nivel_confianza === 'CORROBORADA'
          ? 'Tu denuncia empezó a difundirse respaldada por el caso de la FELCC, en una zona amplia.'
          : 'Tu denuncia empezó a difundirse en la zona. Cuando hagas la denuncia en la FELCC, puedes corroborarla con su número de caso para ampliar el alcance; si no, la alerta vence sola al cumplirse su plazo.',
        [{ text: 'Entendido', onPress: () => navigation.navigate('MainTabs') }],
      );
    } catch (err) {
      // No llegó a enviarse: no se desbloqueó el teléfono, no tiene bloqueo, o
      // el build instalado es anterior a la firma del dispositivo.
      if (err instanceof FirmaNoAutorizada) {
        const titulos = {
          cancelada: 'No se firmó',
          sin_bloqueo: 'Tu teléfono no tiene bloqueo',
          sin_modulo: 'Falta actualizar la aplicación',
        } as const;
        Alert.alert(titulos[err.motivo], err.message);
        return;
      }
      const rechazo = rechazoDe(err, { titulo: 'No se pudo firmar', mensaje: 'Intenta de nuevo.' });
      // Sin el caso no hay forma de firmar: se lleva a la persona a donde se
      // registra, en vez de dejarla frente a un botón que va a fallar igual.
      Alert.alert(
        rechazo.titulo,
        rechazo.mensaje,
        rechazo.codigo === 'DIFUSION_REQUIERE_CASO_FELCC'
          ? [
              { text: 'Ahora no', style: 'cancel' },
              {
                text: 'Registrar el caso',
                // `requiereCaso`: el detalle muestra el campo antes de firmar
                // solo a quien lo necesita, y el servidor acaba de decirlo.
                onPress: () =>
                  navigation.navigate('DenunciaDetail', { id: denunciaId, requiereCaso: true }),
              },
            ]
          : undefined,
      );
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = () => {
    const etiqueta =
      vinculos.find((v) => v.valor === vinculo)?.etiqueta ?? 'la persona';
    Alert.alert(
      '¿Firmar la declaración?',
      `Declaras bajo juramento ser ${etiqueta} de la persona que reportas.\n\nTu identidad quedará asociada de forma permanente a esta denuncia y la alerta empezará a difundirse.\n\nPara firmar te pediremos desbloquear el teléfono.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Firmar', style: 'destructive', onPress: firmar },
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
      ref={scrollRef}
      contentContainerStyle={styles.contenedor}
      keyboardShouldPersistTaps="handled"
      /*
       * El campo del nombre es lo último de la pantalla y el teclado lo tapaba
       * junto con el aviso de «aún no coincide» y el botón de firmar: se
       * escribía a ciegas, sin poder ver si estaba quedando bien.
       *
       * Lo resuelve iOS de forma nativa ajustando las inserciones del scroll y
       * llevando el campo enfocado a la vista. Se prefiere a un
       * `KeyboardAvoidingView` porque éste necesita que se le pase la altura de
       * la cabecera de navegación, y `useHeaderHeight` vive en
       * `@react-navigation/elements`, que no está instalado. En Android el
       * comportamiento equivalente ya lo da `softwareKeyboardLayoutMode:
       * "resize"`, que es lo que trae Expo por defecto.
       */
      automaticallyAdjustKeyboardInsets
      contentInsetAdjustmentBehavior="automatic"
    >
      <Text style={styles.titulo}>Firmar la declaración</Text>

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
      {/*
        * La señal de si coincide va **dentro** del campo, no solo debajo.
        *
        * El borde de color y el texto de error quedan fuera de vista en cuanto
        * sube el teclado, que es justo cuando hacen falta. Un icono pegado al
        * texto que se está escribiendo se ve siempre, y es lo que responde a
        * «¿lo estoy haciendo bien?» mientras se escribe.
        */}
      <View style={styles.campoFila}>
        <TextInput
          style={[
            styles.campo,
            styles.campoTexto,
            nombreEscrito.length > 0 &&
              (nombreCoincide ? styles.campoValido : styles.campoInvalido),
          ]}
          value={nombreEscrito}
          onChangeText={setNombreEscrito}
          onFocus={subirCampo}
          placeholder="Tu nombre completo"
          placeholderTextColor="#9a9a9a"
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
        {nombreEscrito.length > 0 && (
          <Ionicons
            name={nombreCoincide ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={nombreCoincide ? '#0E7247' : '#C2A25A'}
            style={styles.campoIcono}
          />
        )}
      </View>

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
          <Text style={styles.botonTexto}>Firmar declaración jurada</Text>
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
  campoFila: { justifyContent: 'center' },
  campo: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    // Espacio a la derecha para el icono de estado, que va superpuesto.
    paddingRight: 44,
    fontSize: 16,
    backgroundColor: '#fafafa',
  },
  // El color del texto explícito: sin él lo decide el sistema, y en modo oscuro
  // acaba siendo texto claro sobre un fondo claro.
  campoTexto: { color: '#1a1a1a' },
  campoIcono: { position: 'absolute', right: 14 },
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
