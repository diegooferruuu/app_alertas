import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { detalleDescriptivo } from './catalogo-denuncia';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../../hooks/useAuth';
import denunciaService, {
  Denuncia,
  DENUNCIA_META,
  MAX_PROLONGACIONES,
  situacionDe,
  primeraFotografia,
  declaracionService,
} from '../../services/denuncia.service';
import sancionesService, { SituacionSanciones, fechaCorta } from '../../services/sanciones.service';
import { rechazoDe } from '../../services/restricciones';
import {
  FirmaNoAutorizada,
  firmarProlongacionConElTelefono,
} from '../../services/firma-dispositivo';

/**
 * Por qué esta cuenta no puede hacer algo ahora —firmar, prolongar—, o `null`
 * si puede.
 *
 * Es una comodidad, no un control: el servidor vuelve a comprobarlo. Existe para
 * no hacer leer el texto legal y escribir el nombre a quien se va a rechazar al
 * final.
 */
const impedimentoPara = (
  situacion: SituacionSanciones | null,
  queNoPuede: string,
): string | null => {
  if (situacion?.estado === 'SUSPENDIDA') {
    return `Tu cuenta está suspendida: no puedes ${queNoPuede}.`;
  }
  if (situacion?.suspendida_hasta) {
    return `Una persona declaró falsa una denuncia tuya: hasta el ${fechaCorta(
      situacion.suspendida_hasta,
    )} no puedes ${queNoPuede}.`;
  }
  return null;
};

/** Por qué no se firmó una prolongación que no llegó a enviarse. */
const TITULOS_SIN_FIRMA = {
  cancelada: 'No se prolongó',
  sin_bloqueo: 'Tu teléfono no tiene bloqueo',
  sin_modulo: 'Falta actualizar la aplicación',
} as const;

const DenunciaDetailScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const { id } = route.params;
  const { user } = useAuth();
  const [denuncia, setDenuncia] = useState<Denuncia | null>(null);
  const [loading, setLoading] = useState(true);
  const [situacion, setSituacion] = useState<SituacionSanciones | null>(null);

  const [cerrandoCaso, setCerrandoCaso] = useState(false);
  const [prolongando, setProlongando] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await denunciaService.getOne(id);
      setDenuncia(data);
      // Solo hace falta a quien la presentó: para firmarla o prolongarla.
      if (data.es_mia) {
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

  // Sigue abierta mientras nadie la cerró: ni la persona reportada
  // (INVALIDADA) ni quien la presentó (CERRADA, «La encontramos»).
  const abierta = denuncia.estado === 'ACTIVA' || denuncia.estado === 'CADUCADA';

  // Una vez firmada, el contenido queda sellado por su hash: editarlo rompería
  // la cadena probatoria. Y una cerrada ya no se firma ni se edita.
  const editable = denuncia.nivel_confianza === 'REGISTRADA' && denuncia.estado === 'ACTIVA';

  // Quien recibió la alerta puede avisar a la Policía si ve a la persona,
  // también en una vencida, a la que se llega desde la notificación. Sin
  // importar sus sanciones: el reporte no usa la credibilidad del sistema.
  const admiteAvistamiento = !isOwner && denuncia.nivel_confianza !== 'REGISTRADA' && abierta;

  const seDifundio = denuncia.nivel_confianza !== 'REGISTRADA';

  // Vencida aunque el servidor todavía no la haya marcado: lo que cuenta es
  // el plazo.
  const vencida =
    denuncia.estado === 'CADUCADA' ||
    (denuncia.expira_en !== null && new Date(denuncia.expira_en).getTime() <= Date.now());
  const restantes = Math.max(0, MAX_PROLONGACIONES - denuncia.prolongaciones);

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

  /**
   * Prolonga la alerta: el teléfono firma que la persona sigue sin aparecer,
   * con el texto legal vigente, y el servidor la mantiene a la vista otro plazo
   * sin notificar a nadie.
   */
  const prolongar = async () => {
    setProlongando(true);
    try {
      const texto = await declaracionService.textoLegal();
      const firma = await firmarProlongacionConElTelefono(user!.id, {
        denuncia_id: denuncia.id,
        numero: denuncia.prolongaciones + 1,
        hash_texto_legal: texto.hash_texto,
      });
      const resultado = await declaracionService.prolongar(denuncia.id, {
        version_texto_legal_id: texto.version_id,
        ...firma,
      });
      await load();
      Alert.alert(
        'Alerta prolongada',
        `Seguirá a la vista en el mapa y en la lista hasta el ${fechaCorta(
          resultado.expira_en,
        )}. No se notificó a nadie.\n\n${
          resultado.prolongaciones_restantes === 0
            ? 'Era la última prolongación.'
            : resultado.prolongaciones_restantes === 1
              ? 'Te queda 1 prolongación.'
              : `Te quedan ${resultado.prolongaciones_restantes} prolongaciones.`
        }`,
      );
    } catch (err) {
      // No llegó a enviarse: no se desbloqueó el teléfono, no tiene bloqueo, o
      // el build instalado es anterior a la firma del dispositivo.
      if (err instanceof FirmaNoAutorizada) {
        Alert.alert(TITULOS_SIN_FIRMA[err.motivo], err.message);
        return;
      }
      const rechazo = rechazoDe(err, {
        titulo: 'No se pudo prolongar',
        mensaje: 'Inténtalo de nuevo.',
      });
      Alert.alert(rechazo.titulo, rechazo.mensaje);
    } finally {
      setProlongando(false);
    }
  };

  const confirmarProlongar = () => {
    Alert.alert(
      vencida ? '¿Volver a mostrar la alerta?' : '¿Prolongar la alerta?',
      'Seguirá a la vista en el mapa y en la lista por otro plazo, contado desde ahora. No se enviará ninguna notificación.\n\nAl prolongarla declaras, bajo el mismo juramento, que la persona sigue sin aparecer. Te pediremos desbloquear el teléfono.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Prolongar', onPress: prolongar },
      ],
    );
  };

  const impedimentoFirmar = editable ? impedimentoPara(situacion, 'firmar declaraciones') : null;
  const impedimentoProlongar = impedimentoPara(situacion, 'prolongar alertas');
  const fotografia = primeraFotografia(denuncia);
  const date = new Date(denuncia.created_at).toLocaleString();

  const bloqueProlongar = isOwner && seDifundio && abierta && (
    <View style={styles.prolongar}>
      <View style={styles.prolongarFila}>
        <Ionicons name="hourglass-outline" size={16} color="#555" />
        <Text style={styles.prolongarTexto}>
          {denuncia.expira_en
            ? `${vencida ? 'Venció' : 'Vence'} el ${fechaCorta(denuncia.expira_en)}. `
            : ''}
          {restantes === 0
            ? 'Ya usaste todas las prolongaciones.'
            : restantes === 1
              ? 'Te queda 1 prolongación.'
              : `Te quedan ${restantes} prolongaciones.`}
        </Text>
      </View>
      {restantes > 0 &&
        (impedimentoProlongar ? (
          <View style={styles.aviso}>
            <Ionicons name="alert-circle-outline" size={16} color="#8F5600" />
            <Text style={styles.avisoText}>{impedimentoProlongar}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.prolongarButton}
            onPress={confirmarProlongar}
            disabled={prolongando}
          >
            {prolongando ? (
              <ActivityIndicator size="small" color="#1F4FD8" />
            ) : (
              <>
                <Ionicons name="time-outline" size={18} color="#1F4FD8" />
                <Text style={styles.prolongarButtonText}>
                  {vencida ? 'Volver a mostrar la alerta' : 'Prolongar la alerta'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ))}
      <Text style={styles.firmarAyuda}>
        Prolongarla la mantiene en el mapa sin volver a notificar a nadie: la notificación ya
        salió al firmar.
      </Text>
    </View>
  );

  // La alerta no reemplaza la denuncia formal: se recuerda donde quien la
  // presentó vuelve a mirar su caso, sin pedir ningún número que lo pruebe.
  const recordatorioFelcc = isOwner && seDifundio && abierta && (
    <View style={styles.recordatorio}>
      <Ionicons name="information-circle-outline" size={16} color="#1F4FD8" />
      <Text style={styles.recordatorioText}>
        Esta alerta no reemplaza la denuncia en la FELCC. Si todavía no la hiciste, hazla
        también.
      </Text>
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

        {isOwner && (
          <View style={styles.ownerActions}>
            {editable ? (
              <>
                {impedimentoFirmar && (
                  <View style={styles.aviso}>
                    <Ionicons name="alert-circle-outline" size={16} color="#8F5600" />
                    <Text style={styles.avisoText}>{impedimentoFirmar}</Text>
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.firmarButton, impedimentoFirmar ? styles.firmarButtonOff : null]}
                  disabled={Boolean(impedimentoFirmar)}
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
                {bloqueProlongar}
                {recordatorioFelcc}
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
  prolongar: { gap: 10 },
  prolongarFila: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  prolongarTexto: { flex: 1, fontSize: 13, color: '#444', lineHeight: 19 },
  prolongarButton: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1F4FD8',
  },
  prolongarButtonText: { color: '#1F4FD8', fontWeight: '700' },
  recordatorio: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#EAF0FD',
    borderRadius: 10,
    padding: 14,
  },
  recordatorioText: { flex: 1, fontSize: 13, color: '#1B3A8C', lineHeight: 19 },
});

export { DenunciaDetailScreen };
