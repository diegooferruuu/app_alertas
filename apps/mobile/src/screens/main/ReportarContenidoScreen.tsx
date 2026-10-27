import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { OpcionRadio } from '../../components/OpcionRadio';
import denunciaService, { MotivoDeReporte } from '../../services/denuncia.service';

const MOTIVOS: Array<{ motivo: MotivoDeReporte; titulo: string; detalle: string }> = [
  {
    motivo: 'imagen_inapropiada',
    titulo: 'Imagen inapropiada',
    detalle: 'La foto es obscena, violenta o no muestra a una persona.',
  },
  {
    motivo: 'contenido_ofensivo',
    titulo: 'Contenido ofensivo',
    detalle: 'El nombre o la descripción insultan o acosan a alguien.',
  },
  {
    motivo: 'no_es_una_desaparicion',
    titulo: 'No es una desaparición',
    detalle: 'Es una broma, publicidad o algo que no tiene que ver con buscar a una persona.',
  },
  { motivo: 'otro', titulo: 'Otro', detalle: 'Cuéntanos qué pasa en el campo de abajo.' },
];

/**
 * Reportar el contenido de una alerta ajena (política de Google Play).
 *
 * Avisa a quien opera el sistema, que decide si ocultar la foto; no oculta ni
 * detiene nada por sí solo. Y no ofrece «es falsa»: un vecino no sabe si una
 * desaparición es real, y declararla falsa —con su sanción— le corresponde solo
 * a la persona reportada.
 */
export const ReportarContenidoScreen: React.FC<{ navigation: any; route: any }> = ({
  navigation,
  route,
}) => {
  const { denunciaId } = route.params as { denunciaId: string };
  const [motivo, setMotivo] = useState<MotivoDeReporte | null>(null);
  const [detalle, setDetalle] = useState('');
  const [enviando, setEnviando] = useState(false);

  const enviar = async () => {
    if (!motivo) return;
    setEnviando(true);
    try {
      const { mensaje } = await denunciaService.reportarContenido(denunciaId, motivo, detalle);
      Alert.alert('Reporte enviado', mensaje, [{ text: 'Listo', onPress: () => navigation.goBack() }]);
    } catch (err: any) {
      Alert.alert(
        'No se pudo enviar el reporte',
        err?.response?.data?.message || 'Revisa tu conexión e intenta de nuevo.',
      );
      setEnviando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>
        Revisamos cada reporte. Si el contenido no corresponde, la foto deja de mostrarse. Quien
        presentó la alerta no sabe quién la reportó.
      </Text>

      <View style={styles.opciones}>
        {MOTIVOS.map((m) => (
          <OpcionRadio
            key={m.motivo}
            elegida={motivo === m.motivo}
            onPress={() => setMotivo(m.motivo)}
            titulo={m.titulo}
            detalle={m.detalle}
          />
        ))}
      </View>

      <Text style={styles.etiqueta}>
        {motivo === 'otro' ? 'Qué pasa con esta alerta' : 'Algo más (opcional)'}
      </Text>
      <TextInput
        style={styles.detalle}
        value={detalle}
        onChangeText={setDetalle}
        placeholder="Escribe aquí"
        multiline
        maxLength={500}
        editable={!enviando}
      />

      <View style={styles.aviso}>
        <Ionicons name="information-circle-outline" size={16} color="#1F4FD8" />
        <Text style={styles.avisoTexto}>
          Si la alerta es sobre ti y es falsa, no la reportes aquí: ciérrala desde Perfil → Alertas
          sobre mí.
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.boton, (!motivo || enviando) && styles.botonApagado]}
        disabled={!motivo || enviando}
        onPress={enviar}
      >
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>Enviar reporte</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff', flexGrow: 1, gap: 14 },
  intro: { fontSize: 14, color: '#444', lineHeight: 21 },
  opciones: { gap: 10 },
  etiqueta: { fontSize: 13, fontWeight: '700', color: '#777' },
  detalle: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    minHeight: 90,
    textAlignVertical: 'top',
    fontSize: 15,
  },
  aviso: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#EAF0FD',
    borderRadius: 10,
    padding: 14,
  },
  avisoTexto: { flex: 1, fontSize: 13, color: '#1B3A8C', lineHeight: 19 },
  boton: {
    backgroundColor: '#1F4FD8',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
  },
  botonApagado: { backgroundColor: '#aab9e6' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
