import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { detalleDescriptivo } from './catalogo-denuncia';
import { useFocusEffect } from '@react-navigation/native';
import denunciaService, {
  Denuncia,
  DENUNCIA_META,
  situacionDe,
  primeraFotografia,
  declaracionService,
} from '../../services/denuncia.service';
import sancionesService, { SituacionSanciones } from '../../services/sanciones.service';
import { rechazoDe } from '../../services/restricciones';

/**
 * Por qué esta cuenta no puede firmar todavía, o `null` si puede.
 *
 * Es una comodidad, no un control: el servidor vuelve a comprobarlo al firmar.
 * Existe para no hacer leer el texto legal y escribir el nombre a quien se va
 * a rechazar al final.
 */
const impedimentoParaFirmar = (
  situacion: SituacionSanciones | null,
  conCasoFelcc: boolean,
  requiereCaso: boolean,
): string | null => {
  if (situacion?.estado === 'SUSPENDIDA') {
    return 'Tu cuenta está suspendida: no puedes firmar declaraciones.';
  }
  if (requiereCaso && !conCasoFelcc) {
    return 'Por tu historial, tus denuncias solo se difunden con el número de caso de la FELCC. Regístralo abajo para poder firmar.';
  }
  return null;
};

const DenunciaDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { id } = route.params;
  const [denuncia, setDenuncia] = useState<Denuncia | null>(null);
  const [loading, setLoading] = useState(true);
  const [situacion, setSituacion] = useState<SituacionSanciones | null>(null);

  const [numeroCaso, setNumeroCaso] = useState('');
  const [mostrarCampoCaso, setMostrarCampoCaso] = useState(false);
  const [guardandoCaso, setGuardandoCaso] = useState(false);
  const [cerrandoCaso, setCerrandoCaso] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await denunciaService.getOne(id);
      setDenuncia(data);
      // Solo hace falta para quien todavía tiene que firmar.
      if (data.es_mia && data.nivel_confianza === 'REGISTRADA') {
        sancionesService
          .miSituacion()
          .then(setSituacion)
          .catch(() => setSituacion(null));
      }
    } catch (err: any) {
      // La notificación que trajo hasta aquí puede ser vieja: la alerta pudo
      // cerrarse después. El servidor responde igual que si no existiera.
      if (err?.response?.status === 404) {
        Alert.alert('Alerta no disponible', 'Esta alerta ya no está disponible.', [
          { text: 'Entendido', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', 'No se pudo cargar la denuncia.');
      }
    } finally {
      setLoading(false);
    }
  }, [id, navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (loading || !denuncia) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  const meta = DENUNCIA_META;
  const isOwner = denuncia.es_mia;
  const conCasoFelcc = Boolean(denuncia.numero_caso_felcc);

  // Sigue abierta mientras nadie la cerró: ni la persona reportada
  // (INVALIDADA) ni quien la presentó (CERRADA, «La encontramos»).
  const abierta = denuncia.estado === 'ACTIVA' || denuncia.estado === 'CADUCADA';

  // Una vez firmada, el contenido queda sellado por su hash: editarlo rompería
  // la cadena probatoria. Y una cerrada ya no se firma ni se edita.
  const editable = denuncia.nivel_confianza === 'REGISTRADA' && denuncia.estado === 'ACTIVA';

  // Quien tiene una falta no puede difundir sin el caso, así que a esa cuenta
  // se le pide antes de firmar. Lo dice su situación o, si no se pudo
  // consultar, el propio servidor al rechazar la firma (`requiereCaso`).
  const requiereCasoParaFirmar =
    editable && (situacion?.estado === 'CON_FALTA' || Boolean(route.params?.requiereCaso));

  // El caso de la FELCC es la única vía de corroboración, y se ofrece para eso:
  // sobre una denuncia ya difundida, o sobre una vencida, a la que devuelve a
  // difusión. No se pide para denunciar: se puede denunciar antes de haber ido
  // a la FELCC, y pedir el número tan pronto empujaría a inventarlo. Una
  // INVALIDADA o CERRADA ya no lo admite.
  const admiteCaso =
    isOwner && !conCasoFelcc && abierta && (!editable || requiereCasoParaFirmar);

  // Quien recibió la alerta puede avisar a la Policía si ve a la persona,
  // también en una vencida, a la que se llega desde la notificación. Sin
  // importar sus sanciones: el reporte no usa la credibilidad del sistema.
  const admiteAvistamiento = !isOwner && denuncia.nivel_confianza !== 'REGISTRADA' && abierta;

  const seDifundio = denuncia.nivel_confianza !== 'REGISTRADA';

  const darPorEncontrada = async () => {
    setCerrandoCaso(true);
    try {
      const { mensaje } = await denunciaService.darPorEncontrada(denuncia.id);
      await load();
      Alert.alert(seDifundio ? 'Caso cerrado' : 'Denuncia cerrada', mensaje);
    } catch (err) {
      const rechazo = rechazoDe(err, {
        titulo: 'No se pudo cerrar',
        mensaje: 'Inténtalo de nuevo.',
      });
      Alert.alert(rechazo.titulo, rechazo.mensaje);
    } finally {
      setCerrandoCaso(false);
    }
  };

  const confirmarEncontrada = () => {
    Alert.alert(
      '¿La persona apareció?',
      seDifundio
        ? 'La alerta dejará de difundirse de inmediato y no se podrá reactivar. Si vuelve a desaparecer, tendrás que presentar una denuncia nueva.'
        : 'La denuncia se cerrará: no llegó a difundirse. Si vuelve a desaparecer, podrás presentar una nueva.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sí, apareció', onPress: darPorEncontrada },
      ],
    );
  };

  const botonEncontrada = isOwner && abierta && (
    <TouchableOpacity
      style={styles.encontradaButton}
      onPress={confirmarEncontrada}
      disabled={cerrandoCaso}
    >
      {cerrandoCaso ? (
        <ActivityIndicator size="small" color="#0E7247" />
      ) : (
        <>
          <Ionicons name="checkmark-circle-outline" size={18} color="#0E7247" />
          <Text style={styles.encontradaText}>La encontramos</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const registrarCaso = async () => {
    setGuardandoCaso(true);
    try {
      const { nivel_confianza } = await declaracionService.registrarCasoFelcc(
        denuncia.id,
        numeroCaso.trim(),
      );
      setMostrarCampoCaso(false);
      setNumeroCaso('');
      await load();
      Alert.alert(
        'Caso registrado',
        nivel_confianza === 'REGISTRADA'
          ? 'Al firmar, la alerta saldrá respaldada por el caso de la FELCC, con mayor alcance.'
          : 'La alerta quedó respaldada por el caso de la FELCC y amplió su alcance.',
      );
    } catch (err) {
      const rechazo = rechazoDe(err, {
        titulo: 'No se pudo registrar',
        mensaje: 'Revisa el número e intenta de nuevo.',
      });
      Alert.alert(rechazo.titulo, rechazo.mensaje);
    } finally {
      setGuardandoCaso(false);
    }
  };

  const impedimento = editable
    ? impedimentoParaFirmar(situacion, conCasoFelcc, requiereCasoParaFirmar)
    : null;
  const fotografia = primeraFotografia(denuncia);
  const date = new Date(denuncia.created_at).toLocaleString();

  const ayudaCaso = editable
    ? 'Cuando hayas hecho la denuncia en la FELCC, registra aquí su número de caso para poder firmar.'
    : denuncia.estado === 'CADUCADA'
      ? 'La alerta venció. Si ya hiciste la denuncia en la FELCC, registra su número de caso y vuelve a difundirse con mayor alcance.'
      : 'Si ya hiciste la denuncia en la FELCC, registra su número de caso: la alerta amplía su alcance y su plazo.';

  const bloqueCaso = admiteCaso && (
    <View style={styles.casoBloque}>
      {mostrarCampoCaso ? (
        <>
          <Text style={styles.casoEtiqueta}>Número de caso de la FELCC</Text>
          <TextInput
            style={styles.casoCampo}
            value={numeroCaso}
            onChangeText={setNumeroCaso}
            placeholder="Ej. 1234/2026"
            placeholderTextColor="#9a9a9a"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text style={styles.casoNota}>El número queda registrado a tu nombre.</Text>
          <View style={styles.casoAcciones}>
            <TouchableOpacity
              style={styles.casoCancelar}
              onPress={() => {
                setMostrarCampoCaso(false);
                setNumeroCaso('');
              }}
            >
              <Text style={styles.casoCancelarText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.casoGuardar,
                numeroCaso.trim().length < 3 && styles.casoGuardarOff,
              ]}
              disabled={numeroCaso.trim().length < 3 || guardandoCaso}
              onPress={registrarCaso}
            >
              {guardandoCaso ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.casoGuardarText}>Registrar</Text>
              )}
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.casoAyuda}>{ayudaCaso}</Text>
          <TouchableOpacity style={styles.editButton} onPress={() => setMostrarCampoCaso(true)}>
            <Ionicons name="shield-outline" size={18} color="#007AFF" />
            <Text style={styles.editText}>
              {editable ? 'Registrar caso FELCC' : 'Corroborar con la FELCC'}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      {fotografia ? (
        <Image
          source={{ uri: `data:image/jpeg;base64,${fotografia}` }}
          style={styles.photo}
        />
      ) : (
        <View style={[styles.noPhoto, { backgroundColor: `${meta.color}15` }]}>
          <Ionicons name={meta.icon as any} size={48} color={meta.color} />
        </View>
      )}

      <View style={styles.body}>
        <View style={[styles.badge, { backgroundColor: `${meta.color}20` }]}>
          <Ionicons name={meta.icon as any} size={14} color={meta.color} />
          <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
        </View>

        <Text style={styles.name}>{denuncia.nombre_persona_buscada || 'Sin nombre'}</Text>

        <Text style={styles.sectionLabel}>Descripción</Text>
        {detalleDescriptivo(denuncia).map((fila) => (
          <View key={fila.etiqueta} style={styles.filaDato}>
            <Text style={styles.filaEtiqueta}>{fila.etiqueta}</Text>
            <Text style={styles.filaValor}>{fila.valor}</Text>
          </View>
        ))}
        {/* Las denuncias anteriores al desglose solo traen su relato. */}
        {denuncia.description ? (
          <Text style={styles.description}>{denuncia.description}</Text>
        ) : null}

        <View style={styles.metaRow}>
          <Ionicons name="time-outline" size={16} color="#888" />
          <Text style={styles.metaText}>{date}</Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={16} color="#888" />
          <Text style={styles.metaText}>
            {denuncia.latitude.toFixed(5)}, {denuncia.longitude.toFixed(5)}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Ionicons name="flag-outline" size={16} color="#888" />
          <Text style={styles.metaText}>
            {situacionDe(denuncia).label} · {situacionDe(denuncia).desc}
          </Text>
        </View>
        {denuncia.numero_caso_felcc && (
          <View style={styles.metaRow}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#0E7247" />
            <Text style={styles.metaText}>
              Caso FELCC {denuncia.numero_caso_felcc}
            </Text>
          </View>
        )}

        {isOwner && (
          <View style={styles.ownerActions}>
            {editable ? (
              <>
                {impedimento && (
                  <View style={styles.aviso}>
                    <Ionicons name="alert-circle-outline" size={16} color="#8F5600" />
                    <Text style={styles.avisoText}>{impedimento}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.firmarButton, impedimento ? styles.firmarButtonOff : null]}
                  disabled={Boolean(impedimento)}
                  onPress={() =>
                    navigation.navigate('TextoLegal', { denunciaId: denuncia.id })
                  }
                >
                  <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  <Text style={styles.firmarText}>Firmar para difundir</Text>
                </TouchableOpacity>
                <Text style={styles.firmarAyuda}>
                  Por ahora esta denuncia no se difunde. Al firmar la declaración
                  jurada empezará a alertarse a la zona.
                </Text>
                {bloqueCaso}
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => navigation.navigate('EditDenuncia', { denuncia })}
                >
                  <Ionicons name="create-outline" size={18} color="#007AFF" />
                  <Text style={styles.editText}>Editar</Text>
                </TouchableOpacity>
                {botonEncontrada}
              </>
            ) : abierta ? (
              <>
                <View style={styles.aviso}>
                  <Ionicons name="lock-closed-outline" size={16} color="#8F5600" />
                  <Text style={styles.avisoText}>
                    Ya declaraste esta denuncia bajo juramento, así que su contenido
                    quedó sellado. Las denuncias no se eliminan: la alerta deja de
                    difundirse al vencer su plazo, o cuando avisas que la persona
                    apareció.
                  </Text>
                </View>
                {bloqueCaso}
                {botonEncontrada}
              </>
            ) : (
              <View style={styles.cerrada}>
                <Ionicons name="checkmark-done-outline" size={16} color="#0E7247" />
                <Text style={styles.cerradaText}>
                  {denuncia.estado === 'CERRADA'
                    ? `Cerraste este caso${
                        denuncia.cerrada_en
                          ? ` el ${new Date(denuncia.cerrada_en).toLocaleDateString()}`
                          : ''
                      }: la persona apareció. La alerta ya no se difunde.`
                    : 'La persona reportada cerró esta alerta. Ya no se difunde.'}
                </Text>
              </View>
            )}
          </View>
        )}

        {admiteAvistamiento && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.avistamientoButton}
              onPress={() =>
                navigation.navigate('ReportarAvistamiento', {
                  alerta: {
                    id: denuncia.id,
                    nombre_persona_buscada: denuncia.nombre_persona_buscada,
                    numero_caso_felcc: denuncia.numero_caso_felcc,
                  },
                })
              }
            >
              <Ionicons name="eye-outline" size={18} color="#fff" />
              <Text style={styles.firmarText}>Vi a esta persona</Text>
            </TouchableOpacity>
            <Text style={styles.firmarAyuda}>
              Arma un reporte para la Policía. Lo entregas tú; la aplicación no lo guarda.
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { backgroundColor: '#fff', flexGrow: 1 },
  photo: { width: '100%', height: 260, resizeMode: 'cover' },
  noPhoto: { width: '100%', height: 180, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 20 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  badgeText: { fontSize: 13, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: '#999', marginBottom: 6 },
  description: { fontSize: 15, color: '#333', lineHeight: 22, marginBottom: 20 },
  filaDato: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f2f2f2',
  },
  filaEtiqueta: { fontSize: 14, color: '#888' },
  filaValor: { fontSize: 14, color: '#1a1a1a', fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  metaText: { fontSize: 13, color: '#888', flexShrink: 1 },
  ownerActions: { marginTop: 24, gap: 12 },
  firmarButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#B32C24',
  },
  firmarButtonOff: { backgroundColor: '#c3c9d6' },
  avistamientoButton: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 10,
    backgroundColor: '#1F4FD8',
  },
  firmarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  firmarAyuda: { fontSize: 13, color: '#777', lineHeight: 18, textAlign: 'center' },
  aviso: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#F9EEDA',
    borderRadius: 10,
    padding: 14,
  },
  avisoText: { flex: 1, fontSize: 13, color: '#6B4300', lineHeight: 19 },
  cerrada: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#E2F2EA',
    borderRadius: 10,
    padding: 14,
  },
  cerradaText: { flex: 1, fontSize: 13, color: '#0B5A38', lineHeight: 19 },
  encontradaButton: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0E7247',
  },
  encontradaText: { color: '#0E7247', fontWeight: '700' },
  editButton: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  editText: { color: '#007AFF', fontWeight: '600' },
  casoBloque: { gap: 10 },
  casoAyuda: { fontSize: 13, color: '#555', lineHeight: 19 },
  casoEtiqueta: { fontSize: 14, fontWeight: '600', color: '#333' },
  casoCampo: {
    borderWidth: 1.5,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1a1a1a',
    backgroundColor: '#fafafa',
  },
  casoNota: { fontSize: 12, color: '#888' },
  casoAcciones: { flexDirection: 'row', gap: 10 },
  casoCancelar: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    alignItems: 'center',
  },
  casoCancelarText: { color: '#666', fontWeight: '600' },
  casoGuardar: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: '#0E7247',
    alignItems: 'center',
  },
  casoGuardarOff: { backgroundColor: '#c3c9d6' },
  casoGuardarText: { color: '#fff', fontWeight: '700' },
});

export { DenunciaDetailScreen };
