import React, { useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { prepararParaEnviar } from '../../services/imagenes';
import { esMenorDeEdad } from '../../utils/minoria-edad';
import denunciaService, {
  Denuncia,
  primeraFotografia,
} from '../../services/denuncia.service';
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
 * Corrección de una denuncia todavía no declarada bajo juramento.
 *
 * Ofrece los mismos campos cerrados que el formulario de creación y ninguno más:
 * si la edición admitiera un recuadro de texto que la creación no acepta, la
 * puerta cerrada en un sitio quedaría abierta en el otro. El documento de la
 * persona buscada no se puede corregir —cambiarlo redirigiría la denuncia hacia
 * otra persona conservando su historia—, así que ni siquiera aparece.
 */
const EditDenunciaScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const denuncia: Denuncia = route.params.denuncia;

  const [nombrePersonaBuscada, setNombrePersonaBuscada] = useState(
    denuncia.nombre_persona_buscada || '',
  );
  const [sexo, setSexo] = useState(denuncia.sexo);
  const [estatura, setEstatura] = useState(denuncia.estatura_rango);
  const [contextura, setContextura] = useState(denuncia.contextura);
  const [colorPiel, setColorPiel] = useState(denuncia.color_piel);
  const [colorCabello, setColorCabello] = useState(denuncia.color_cabello);
  const [colorOjos, setColorOjos] = useState(denuncia.color_ojos);
  const [senas, setSenas] = useState<string[]>(denuncia.senas_particulares ?? []);
  const [prendaSuperior, setPrendaSuperior] = useState(denuncia.prenda_superior);
  const [colorSuperior, setColorSuperior] = useState(denuncia.color_prenda_superior);
  const [prendaInferior, setPrendaInferior] = useState(denuncia.prenda_inferior);
  const [colorInferior, setColorInferior] = useState(denuncia.color_prenda_inferior);
  const [calzado, setCalzado] = useState(denuncia.calzado);
  const [circunstancia, setCircunstancia] = useState(denuncia.circunstancia);
  const [condiciones, setCondiciones] = useState<string[]>(
    denuncia.condicion_relevante ?? [],
  );

  // La denuncia de un menor no lleva fotografía. La fecha de nacimiento no se
  // edita en esta pantalla, así que basta leerla del caso.
  const esMenor = esMenorDeEdad(
    denuncia.fecha_nacimiento ? new Date(denuncia.fecha_nacimiento) : null,
  );

  const fotografiaOriginal = primeraFotografia(denuncia);
  const [photo, setPhoto] = useState<string | null>(fotografiaOriginal);
  const [saving, setSaving] = useState(false);

  const pickPhoto = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!r.canceled) {
      setPhoto(await prepararParaEnviar(r.assets[0].uri, r.assets[0].width));
    }
  };

  const handleSave = async () => {
    if (nombrePersonaBuscada.trim().length < 2) {
      Alert.alert('Falta el nombre', 'Ingresa el nombre de la persona desaparecida.');
      return;
    }

    setSaving(true);
    try {
      await denunciaService.update(denuncia.id, {
        nombre_persona_buscada: nombrePersonaBuscada.trim(),
        // Se envía solo lo que tiene valor: un campo sin elegir en una denuncia
        // anterior al desglose no debe mandarse como nulo, porque el servidor
        // lo rechazaría por no pertenecer a su dominio.
        ...(sexo ? { sexo } : {}),
        ...(estatura ? { estatura_rango: estatura } : {}),
        ...(contextura ? { contextura } : {}),
        ...(colorPiel ? { color_piel: colorPiel } : {}),
        ...(colorCabello ? { color_cabello: colorCabello } : {}),
        ...(colorOjos ? { color_ojos: colorOjos } : {}),
        ...(senas.length > 0 ? { senas_particulares: senas } : {}),
        ...(prendaSuperior ? { prenda_superior: prendaSuperior } : {}),
        ...(colorSuperior ? { color_prenda_superior: colorSuperior } : {}),
        ...(prendaInferior ? { prenda_inferior: prendaInferior } : {}),
        ...(colorInferior ? { color_prenda_inferior: colorInferior } : {}),
        ...(calzado ? { calzado } : {}),
        ...(circunstancia ? { circunstancia } : {}),
        ...(condiciones.length > 0 ? { condicion_relevante: condiciones } : {}),
        // La foto solo se envía si cambió: reenviar la misma imagen la
        // reescribiría sin motivo, y son cientos de kilobytes.
        ...(photo && photo !== fotografiaOriginal
          ? { fotografia_base64: photo }
          : {}),
      });
      Alert.alert('Guardado', 'La denuncia fue actualizada.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err: any) {
      const mensaje = err?.response?.data?.message;
      Alert.alert(
        'Error',
        Array.isArray(mensaje)
          ? mensaje.join('\n')
          : mensaje || 'No se pudo guardar.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>Editar denuncia</Text>

      <Text style={styles.label}>Nombre de la persona desaparecida</Text>
      <TextInput
        style={styles.input}
        value={nombrePersonaBuscada}
        onChangeText={setNombrePersonaBuscada}
        autoCapitalize="words"
        maxLength={120}
      />

      <Text style={styles.seccion}>Descripción física</Text>
      <SelectorCerrado etiqueta="Sexo" opciones={SEXO} valor={sexo} onChange={setSexo} />
      <SelectorCerrado
        etiqueta="Estatura aproximada"
        opciones={ESTATURA_RANGO}
        valor={estatura}
        onChange={setEstatura}
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

      <Text style={styles.seccion}>Circunstancia y ropa</Text>
      <SelectorCerrado
        etiqueta="Circunstancia"
        opciones={CIRCUNSTANCIA}
        valor={circunstancia}
        onChange={setCircunstancia}
      />
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
      />

      <Text style={styles.label}>Foto</Text>
      {esMenor ? (
        <View style={styles.avisoMenor}>
          <Ionicons name="shield-checkmark-outline" size={20} color="#8F5600" />
          <Text style={styles.avisoMenorTexto}>
            Como la persona buscada es menor de edad, la alerta no lleva
            fotografía. Se difunde con su descripción física.
          </Text>
        </View>
      ) : photo ? (
        <View style={styles.photoWrap}>
          <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.photo} />
          <TouchableOpacity style={styles.photoChange} onPress={pickPhoto}>
            <Ionicons name="camera-outline" size={18} color="#fff" />
            <Text style={styles.photoChangeText}>Cambiar</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity style={styles.photoButton} onPress={pickPhoto}>
          <Ionicons name="camera-outline" size={22} color="#007AFF" />
          <Text style={styles.photoButtonText}>Agregar foto</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.button, saving && styles.buttonDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Guardar cambios</Text>
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
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 10, marginTop: 16 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
  },
  avisoMenor: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#FFF8EC',
    borderWidth: 1,
    borderColor: '#F0DCB8',
    borderRadius: 10,
    padding: 14,
  },
  avisoMenorTexto: { flex: 1, fontSize: 14, lineHeight: 20, color: '#8F5600' },
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
  photoChange: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  photoChangeText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});

export { EditDenunciaScreen };
