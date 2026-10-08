import React, { useRef, useState } from 'react';
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
import { declaracionService } from '../../services/denuncia.service';
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
  // Todo viene de la pantalla anterior, donde se eligió el vínculo y se leyó el
  // texto con él. `hashTextoLegal` y `vinculo` entran en lo que firma el
  // teléfono; `etiquetaVinculo` es cómo se nombró en el texto.
  const { denunciaId, versionId, hashTextoLegal, vinculo, etiquetaVinculo } = route.params;
  const { user } = useAuth();

  const [nombreEscrito, setNombreEscrito] = useState('');
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

      await declaracionService.firmar(denunciaId, {
        version_texto_legal_id: versionId,
        vinculo_declarado: vinculo!,
        nombre_escrito: nombreEscrito,
        ...firma,
      });
      // El recordatorio de la FELCC va aquí, en el momento en que la persona
      // siente que «ya denunció»: la alerta no reemplaza la denuncia formal, y
      // la app no pide ningún número que lo pruebe.
      Alert.alert(
        'Declaración firmada',
        'Tu denuncia empezó a difundirse en la zona. La alerta vence sola al cumplirse su plazo, y puedes prolongarla desde su detalle.\n\nHaz también la denuncia en la FELCC: esta alerta no la reemplaza.',
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
      // Una suspensión no se arregla reintentando: se ofrece ver por qué y
      // hasta cuándo, en vez de dejar a la persona frente a un botón que va a
      // fallar igual.
      const suspendida =
        rechazo.codigo === 'CUENTA_SUSPENDIDA_TEMPORALMENTE' ||
        rechazo.codigo === 'CUENTA_SUSPENDIDA';
      Alert.alert(
        rechazo.titulo,
        rechazo.mensaje,
        suspendida
          ? [
              { text: 'Entendido', style: 'cancel' },
              { text: 'Ver mi situación', onPress: () => navigation.navigate('MiSituacion') },
            ]
          : undefined,
      );
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = () => {
    Alert.alert(
      '¿Firmar la declaración?',
      `Declaras bajo juramento ser ${etiquetaVinculo} de la persona que reportas.\n\nTu identidad quedará asociada de forma permanente a esta denuncia y la alerta empezará a difundirse.\n\nPara firmar te pediremos desbloquear el teléfono.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Firmar', style: 'destructive', onPress: firmar },
      ],
    );
  };

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

      {/* El vínculo se eligió antes de leer el texto, que lo nombra. Cambiarlo
          es volver a leerlo: el texto con otro vínculo es otra declaración. */}
      <View style={styles.resumen}>
        <Text style={styles.resumenTexto}>
          Declaras bajo juramento ser{' '}
          <Text style={styles.resumenVinculo}>{etiquetaVinculo}</Text> de la persona
          que reportas.
        </Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cambiar}>Cambiar</Text>
        </TouchableOpacity>
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
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 20 },
  etiqueta: { fontSize: 15, fontWeight: '600', color: '#333', marginTop: 16, marginBottom: 6 },
  ayuda: { fontSize: 13, color: '#777', marginBottom: 10, lineHeight: 18 },
  resumen: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F0F6FF',
    borderWidth: 1,
    borderColor: '#D6E2FB',
  },
  resumenTexto: { flex: 1, fontSize: 15, color: '#333', lineHeight: 21 },
  resumenVinculo: { fontWeight: '700', color: '#1B44BB' },
  cambiar: { color: '#007AFF', fontWeight: '600', fontSize: 14 },
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
