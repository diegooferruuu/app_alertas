import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import denunciaService from '../../services/denuncia.service';
import {
  SelectorCerrado,
  SelectorMultiple,
} from '../../components/SelectorCerrado';
import {
  CALZADO,
  CIRCUNSTANCIA,
  COLOR_CABELLO,
  COLOR_OJOS,
  COLOR_PIEL,
  COLOR_PRENDA,
  CONDICION_RELEVANTE,
  CONTEXTURA,
  ESTATURA_RANGO,
  PRENDA_INFERIOR,
  PRENDA_SUPERIOR,
  SENA_PARTICULAR,
  SEXO,
} from './catalogo-denuncia';

/**
 * Formulario de denuncia de desaparición.
 *
 * Salvo el nombre de la persona buscada, aquí no se escribe: se elige. La
 * defensa frente a la desinformación no está en moderar lo que se escribe sino
 * en que lo problemático no pueda escribirse, y por eso no hay ningún recuadro
 * de texto donde quepan una acusación, el nombre de un tercero o un teléfono.
 */
const ReportarDenunciaScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [nombrePersonaBuscada, setNombrePersonaBuscada] = useState('');
  const [ciPersonaBuscada, setCiPersonaBuscada] = useState('');

  // Persona buscada
  const [fechaNacimiento, setFechaNacimiento] = useState<Date | null>(null);
  const [sexo, setSexo] = useState<string | null>(null);
  const [estatura, setEstatura] = useState<string | null>(null);
  const [contextura, setContextura] = useState<string | null>(null);
  const [colorPiel, setColorPiel] = useState<string | null>(null);
  const [colorCabello, setColorCabello] = useState<string | null>(null);
  const [colorOjos, setColorOjos] = useState<string | null>(null);
  const [senas, setSenas] = useState<string[]>([]);

  // Hecho
  const [avistamiento, setAvistamiento] = useState<Date | null>(null);
  const [prendaSuperior, setPrendaSuperior] = useState<string | null>(null);
  const [colorSuperior, setColorSuperior] = useState<string | null>(null);
  const [prendaInferior, setPrendaInferior] = useState<string | null>(null);
  const [colorInferior, setColorInferior] = useState<string | null>(null);
  const [calzado, setCalzado] = useState<string | null>(null);
  const [circunstancia, setCircunstancia] = useState<string | null>(null);
  const [condiciones, setCondiciones] = useState<string[]>([]);

  const [photo, setPhoto] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [calendarioNacimiento, setCalendarioNacimiento] = useState(false);
  const [calendarioAvistamiento, setCalendarioAvistamiento] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({});
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        }
      } finally {
        setLocating(false);
      }
    })();
  }, []);

  const pickPhoto = async () => {
    if (Platform.OS === 'web') {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });
      if (!result.canceled && result.assets[0].base64) setPhoto(result.assets[0].base64);
      return;
    }
    Alert.alert('Agregar foto', 'Elige una opción', [
      {
        text: 'Tomar foto',
        onPress: async () => {
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') return;
          const r = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
          if (!r.canceled && r.assets[0].base64) setPhoto(r.assets[0].base64);
        },
      },
      {
        text: 'Galería',
        onPress: async () => {
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') return;
          const r = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
            base64: true,
          });
          if (!r.canceled && r.assets[0].base64) setPhoto(r.assets[0].base64);
        },
      },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  const soloFecha = (fecha: Date): string => {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, '0');
    const d = String(fecha.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await denunciaService.create({
        nombre_persona_buscada: nombrePersonaBuscada.trim(),
        ci_persona_buscada: ciPersonaBuscada.trim(),
        fecha_nacimiento: soloFecha(fechaNacimiento!),
        sexo: sexo!,
        estatura_rango: estatura!,
        contextura: contextura!,
        color_piel: colorPiel!,
        color_cabello: colorCabello!,
        color_ojos: colorOjos!,
        // Ausente es un dato: no se manda un arreglo vacío.
        senas_particulares: senas.length > 0 ? senas : undefined,
        ultimo_avistamiento_en: avistamiento!.toISOString(),
        prenda_superior: prendaSuperior!,
        color_prenda_superior: colorSuperior!,
        prenda_inferior: prendaInferior!,
        color_prenda_inferior: colorInferior!,
        calzado: calzado ?? undefined,
        circunstancia: circunstancia!,
        condicion_relevante: condiciones.length > 0 ? condiciones : undefined,
        latitude: coords!.lat,
        longitude: coords!.lng,
        fotografia_base64: photo!,
      });
      Alert.alert(
        'Denuncia registrada',
        'Por ahora solo tú la ves. Firma la declaración para que se alerte a la zona.',
        [{ text: 'OK', onPress: () => navigation.goBack() }],
      );
    } catch (err: any) {
      const mensaje = err?.response?.data?.message;
      Alert.alert(
        'Error al reportar',
        Array.isArray(mensaje)
          ? mensaje.join('\n')
          : mensaje || err?.message || 'Intenta de nuevo.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Devuelve el primer problema encontrado, o `null` si el formulario está listo. */
  const primerFaltante = (): string | null => {
    if (nombrePersonaBuscada.trim().length < 2) {
      return 'Ingresa el nombre de la persona desaparecida.';
    }
    if (!/^\d{5,12}$/.test(ciPersonaBuscada.trim())) {
      return 'Necesitamos el número de carnet de la persona desaparecida. Es lo que le permite retirar la alerta si hubo un error.';
    }
    if (!fechaNacimiento) return 'Falta la fecha de nacimiento.';
    if (!sexo) return 'Falta el sexo.';
    if (!estatura) return 'Falta la estatura aproximada.';
    if (!contextura) return 'Falta la contextura.';
    if (!colorPiel) return 'Falta el color de piel.';
    if (!colorCabello) return 'Falta el color de cabello.';
    if (!colorOjos) return 'Falta el color de ojos.';
    if (!avistamiento) return 'Falta cuándo se la vio por última vez.';
    if (avistamiento.getTime() > Date.now()) {
      return 'La fecha del último avistamiento no puede ser futura.';
    }
    if (fechaNacimiento > avistamiento) {
      return 'La fecha de nacimiento no puede ser posterior al último avistamiento.';
    }
    if (!prendaSuperior) return 'Falta la prenda de la parte de arriba.';
    if (!colorSuperior) return 'Falta el color de la prenda de arriba.';
    if (!prendaInferior) return 'Falta la prenda de la parte de abajo.';
    if (!colorInferior) return 'Falta el color de la prenda de abajo.';
    if (!circunstancia) return 'Falta la circunstancia de la desaparición.';
    if (!photo) return 'La fotografía es obligatoria: sin imagen la alerta no sirve para reconocer.';
    if (!coords) return 'No pudimos obtener tu ubicación. Activa el GPS e intenta de nuevo.';
    return null;
  };

  const handleSubmit = () => {
    const falta = primerFaltante();
    if (falta) {
      Alert.alert('Faltan datos', falta);
      return;
    }

    Alert.alert(
      '¿Confirmar denuncia?',
      `Estás por registrar la desaparición de "${nombrePersonaBuscada.trim()}".\n\nPor ahora la verás solo tú. Para que se alerte a la zona tendrás que firmar una declaración jurada.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, denunciar', style: 'destructive', onPress: submit },
      ],
    );
  };

  const hoy = new Date();

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Reportar desaparición</Text>

      <View style={styles.banner}>
        <Ionicons name="search" size={18} color="#FF3B30" />
        <Text style={styles.bannerText}>Denuncia de persona desaparecida</Text>
      </View>

      <Text style={styles.seccion}>Quién es</Text>

      <Text style={styles.label}>Nombre de la persona desaparecida</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: María Pérez López"
        value={nombrePersonaBuscada}
        onChangeText={setNombrePersonaBuscada}
        autoCapitalize="words"
        maxLength={120}
      />

      <Text style={styles.label}>Número de carnet de la persona desaparecida</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 9876543"
        value={ciPersonaBuscada}
        onChangeText={(v) => setCiPersonaBuscada(v.replace(/\D/g, ''))}
        keyboardType="numeric"
        maxLength={12}
      />
      <Text style={styles.hint}>
        Lo pedimos porque es lo que permite a esa persona retirar la alerta si hubo
        un error. No guardamos el número: solo una huella cifrada de él.
      </Text>

      <View style={styles.campo}>
        <Text style={styles.label}>Fecha de nacimiento</Text>
        <TouchableOpacity
          style={styles.control}
          onPress={() => setCalendarioNacimiento(true)}
        >
          <Text style={fechaNacimiento ? styles.valor : styles.marcador}>
            {fechaNacimiento ? soloFecha(fechaNacimiento) : 'Elegir fecha…'}
          </Text>
          <Text style={styles.chevron}>📅</Text>
        </TouchableOpacity>
      </View>

      {calendarioNacimiento && (
        <>
          <DateTimePicker
            value={fechaNacimiento ?? new Date(1995, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={hoy}
            minimumDate={new Date(hoy.getFullYear() - 110, 0, 1)}
            onChange={(evento, elegida) => {
              if (Platform.OS !== 'ios') setCalendarioNacimiento(false);
              if (evento.type === 'dismissed') return;
              if (elegida) setFechaNacimiento(elegida);
            }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.confirmar}
              onPress={() => setCalendarioNacimiento(false)}
            >
              <Text style={styles.confirmarTexto}>Confirmar fecha</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <SelectorCerrado etiqueta="Sexo" opciones={SEXO} valor={sexo} onChange={setSexo} />
      <SelectorCerrado
        etiqueta="Estatura aproximada"
        opciones={ESTATURA_RANGO}
        valor={estatura}
        onChange={setEstatura}
        ayuda="Un tramo aproximado describe mejor que un número exacto que no se sabe."
      />
      <SelectorCerrado
        etiqueta="Contextura"
        opciones={CONTEXTURA}
        valor={contextura}
        onChange={setContextura}
      />
      <SelectorCerrado
        etiqueta="Color de piel"
        opciones={COLOR_PIEL}
        valor={colorPiel}
        onChange={setColorPiel}
      />
      <SelectorCerrado
        etiqueta="Color de cabello"
        opciones={COLOR_CABELLO}
        valor={colorCabello}
        onChange={setColorCabello}
      />
      <SelectorCerrado
        etiqueta="Color de ojos"
        opciones={COLOR_OJOS}
        valor={colorOjos}
        onChange={setColorOjos}
      />
      <SelectorMultiple
        etiqueta="Señas particulares"
        opciones={SENA_PARTICULAR}
        valores={senas}
        onChange={setSenas}
      />

      <Text style={styles.seccion}>Cómo desapareció</Text>

      <View style={styles.campo}>
        <Text style={styles.label}>Última vez que se la vio</Text>
        <TouchableOpacity
          style={styles.control}
          onPress={() => setCalendarioAvistamiento(true)}
        >
          <Text style={avistamiento ? styles.valor : styles.marcador}>
            {avistamiento ? avistamiento.toLocaleString() : 'Elegir fecha y hora…'}
          </Text>
          <Text style={styles.chevron}>🕑</Text>
        </TouchableOpacity>
      </View>

      {calendarioAvistamiento && (
        <>
          <DateTimePicker
            value={avistamiento ?? new Date()}
            mode={Platform.OS === 'ios' ? 'datetime' : 'date'}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            maximumDate={new Date()}
            onChange={(evento, elegida) => {
              if (Platform.OS !== 'ios') setCalendarioAvistamiento(false);
              if (evento.type === 'dismissed') return;
              if (elegida) setAvistamiento(elegida);
            }}
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.confirmar}
              onPress={() => setCalendarioAvistamiento(false)}
            >
              <Text style={styles.confirmarTexto}>Confirmar</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <SelectorCerrado
        etiqueta="Circunstancia"
        opciones={CIRCUNSTANCIA}
        valor={circunstancia}
        onChange={setCircunstancia}
        ayuda="Describe cómo se perdió el contacto. No es el lugar para señalar a nadie."
      />

      <Text style={styles.seccion}>Cómo iba vestida</Text>

      <SelectorCerrado
        etiqueta="Prenda de arriba"
        opciones={PRENDA_SUPERIOR}
        valor={prendaSuperior}
        onChange={setPrendaSuperior}
      />
      <SelectorCerrado
        etiqueta="Color de la prenda de arriba"
        opciones={COLOR_PRENDA}
        valor={colorSuperior}
        onChange={setColorSuperior}
      />
      <SelectorCerrado
        etiqueta="Prenda de abajo"
        opciones={PRENDA_INFERIOR}
        valor={prendaInferior}
        onChange={setPrendaInferior}
      />
      <SelectorCerrado
        etiqueta="Color de la prenda de abajo"
        opciones={COLOR_PRENDA}
        valor={colorInferior}
        onChange={setColorInferior}
      />
      <SelectorCerrado
        etiqueta="Calzado"
        opciones={CALZADO}
        valor={calzado}
        onChange={setCalzado}
        opcional
      />

      <SelectorMultiple
        etiqueta="Condiciones a tener en cuenta"
        opciones={CONDICION_RELEVANTE}
        valores={condiciones}
        onChange={setCondiciones}
        ayuda="Ayuda a quien la encuentre a saber si necesita atención inmediata."
      />

      <Text style={styles.seccion}>Fotografía y lugar</Text>

      <Text style={styles.label}>Fotografía (obligatoria, rostro visible)</Text>
      {photo ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photo} />
          <TouchableOpacity style={styles.photoRemove} onPress={() => setPhoto(null)}>
            <Ionicons name="close-circle" size={26} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
          <Ionicons name="camera-outline" size={22} color="#007AFF" />
          <Text style={styles.photoButtonText}>Agregar foto</Text>
        </TouchableOpacity>
      )}

      <View style={styles.locationBox}>
        {locating ? (
          <>
            <Ionicons name="location-outline" size={16} color="#444" />
            <Text style={styles.locationText}>Obteniendo ubicación...</Text>
          </>
        ) : coords ? (
          <>
            <Ionicons name="location" size={16} color="#007AFF" />
            <Text style={styles.locationText}>
              Ubicación: {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="warning" size={16} color="#FF3B30" />
            <Text style={[styles.locationText, { color: '#FF3B30' }]}>
              Sin ubicación (activa el GPS)
            </Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, (submitting || locating) && styles.buttonDisabled]}
        onPress={handleSubmit}
        disabled={submitting || locating}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Enviar reporte</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 24, backgroundColor: '#fff', flexGrow: 1 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 16, color: '#1a1a1a' },
  seccion: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 28,
    marginBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#f0f0f0',
    paddingBottom: 6,
  },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8, marginTop: 16 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF0EE',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  bannerText: { color: '#FF3B30', fontWeight: '600', fontSize: 14 },
  hint: { fontSize: 12, color: '#888', marginTop: 6, lineHeight: 17 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  campo: { marginTop: 0 },
  control: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valor: { fontSize: 15, color: '#1a1a1a' },
  marcador: { fontSize: 15, color: '#999' },
  chevron: { fontSize: 14, color: '#666' },
  confirmar: {
    alignSelf: 'center',
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#eef4ff',
  },
  confirmarTexto: { color: '#007AFF', fontWeight: '600' },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 16,
    justifyContent: 'center',
  },
  photoButtonText: { color: '#007AFF', fontSize: 15, fontWeight: '600' },
  photoWrap: { position: 'relative' },
  photo: { width: '100%', height: 200, borderRadius: 10, resizeMode: 'cover' },
  photoRemove: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#fff',
    borderRadius: 13,
  },
  locationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderRadius: 10,
  },
  locationText: { fontSize: 13, color: '#444' },
  button: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export { ReportarDenunciaScreen };
