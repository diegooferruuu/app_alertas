import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import sancionesService, {
  EstadoSancion,
  FUNCIONES,
  SituacionSanciones,
  presentacionDe,
} from '../../services/sanciones.service';

/** Los tres estados en el orden en que se avanza por ellos. */
const ESCALERA: { estado: EstadoSancion; titulo: string; detalle: string }[] = [
  {
    estado: 'NORMAL',
    titulo: 'Sin faltas',
    detalle: 'Tus denuncias se difunden al firmarlas.',
  },
  {
    estado: 'CON_FALTA',
    titulo: 'Con falta',
    detalle:
      'Una persona declaró falsa una denuncia tuya. Solo se difunden las que llevan el número de caso de la FELCC.',
  },
  {
    estado: 'SUSPENDIDA',
    titulo: 'Suspendida',
    detalle:
      'Dos personas distintas lo declararon. No puedes denunciar, firmar ni recibir alertas, y tu documento queda bloqueado.',
  },
];

/**
 * La situación de la cuenta frente al régimen de faltas.
 *
 * Existe porque las sanciones son automáticas: no hay a quién reclamarle, así
 * que lo mínimo es que se puedan leer. Dice en qué estado está la cuenta, qué
 * puede y qué no puede hacer, y cómo se llega a cada estado.
 *
 * De cada falta muestra solo la fecha. El servidor no envía la denuncia que la
 * originó ni a la persona que cerró la alerta.
 */
const MiSituacionScreen: React.FC = () => {
  const [situacion, setSituacion] = useState<SituacionSanciones | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [fallo, setFallo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setSituacion(await sancionesService.miSituacion());
      setFallo(false);
    } catch {
      // Se conserva lo que había: un fallo de red no puede presentarse como
      // «sin faltas».
      setFallo(true);
    } finally {
      setCargando(false);
      setRefrescando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  if (cargando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!situacion) {
    return (
      <View style={styles.centro}>
        <Ionicons name="cloud-offline-outline" size={40} color="#8E8E93" />
        <Text style={styles.falloTexto}>No se pudo consultar tu situación.</Text>
        <TouchableOpacity
          style={styles.reintentar}
          onPress={() => {
            setCargando(true);
            cargar();
          }}
        >
          <Ionicons name="refresh" size={16} color="#007AFF" />
          <Text style={styles.reintentarTexto}>Reintentar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const presentacion = presentacionDe(situacion);
  const restringidas = new Set(situacion.funciones_restringidas);
  const nivelActual = ESCALERA.findIndex((p) => p.estado === situacion.estado);

  return (
    <ScrollView
      contentContainerStyle={styles.contenedor}
      refreshControl={
        <RefreshControl
          refreshing={refrescando}
          onRefresh={() => {
            setRefrescando(true);
            cargar();
          }}
        />
      }
    >
      {fallo && (
        <Text style={styles.desactualizado}>
          No se pudo actualizar. Se muestra la última situación consultada.
        </Text>
      )}

      <View style={[styles.estado, { backgroundColor: presentacion.fondo }]}>
        <Ionicons name={presentacion.icono as any} size={28} color={presentacion.color} />
        <View style={styles.estadoCuerpo}>
          <Text style={[styles.estadoTitulo, { color: presentacion.color }]}>
            {presentacion.titulo}
          </Text>
          <Text style={styles.estadoDetalle}>{presentacion.detalle}</Text>
        </View>
      </View>

      <Text style={styles.seccion}>Lo que puedes hacer</Text>
      <View style={styles.bloque}>
        {FUNCIONES.map(({ funcion, etiqueta }, i) => {
          const restringida = restringidas.has(funcion);
          return (
            <View key={funcion} style={[styles.funcion, i > 0 && styles.separada]}>
              <Ionicons
                name={restringida ? 'close-circle' : 'checkmark-circle'}
                size={20}
                color={restringida ? '#B32C24' : '#0E7247'}
              />
              <Text style={styles.funcionTexto}>{etiqueta}</Text>
              <Text style={[styles.funcionEstado, restringida && styles.funcionRestringida]}>
                {restringida ? 'Restringido' : 'Permitido'}
              </Text>
            </View>
          );
        })}
      </View>

      {situacion.faltas.length > 0 && (
        <>
          <Text style={styles.seccion}>Tus faltas</Text>
          <View style={styles.bloque}>
            {situacion.faltas.map((falta, i) => (
              <View key={`${falta.creada_en}-${i}`} style={[styles.falta, i > 0 && styles.separada]}>
                <Ionicons name="time-outline" size={18} color="#8F5600" />
                <View style={styles.faltaCuerpo}>
                  <Text style={styles.faltaFecha}>
                    {new Date(falta.creada_en).toLocaleDateString()}
                  </Text>
                  <Text style={styles.faltaDetalle}>
                    Una persona declaró falsa una denuncia tuya.
                  </Text>
                </View>
              </View>
            ))}
          </View>
          <Text style={styles.nota}>Las faltas no vencen.</Text>
        </>
      )}

      <Text style={styles.seccion}>Cómo funciona</Text>
      <View style={styles.escalera}>
        {ESCALERA.map((paso, i) => {
          const actual = i === nivelActual;
          return (
            <View key={paso.estado} style={styles.paso}>
              <View style={styles.pasoGuia}>
                <View style={[styles.pasoPunto, actual && { backgroundColor: presentacion.color }]}>
                  <Text style={[styles.pasoNumero, actual && styles.pasoNumeroActual]}>
                    {i + 1}
                  </Text>
                </View>
                {i < ESCALERA.length - 1 && <View style={styles.pasoLinea} />}
              </View>
              <View style={styles.pasoCuerpo}>
                <Text style={[styles.pasoTitulo, actual && { color: presentacion.color }]}>
                  {paso.titulo}
                  {actual ? ' · tu situación' : ''}
                </Text>
                <Text style={styles.pasoDetalle}>{paso.detalle}</Text>
              </View>
            </View>
          );
        })}
      </View>

      <Text style={styles.pie}>
        «Estoy bien» nunca deja una falta, y que una alerta venza sin respaldo tampoco. Estas
        reglas las aplica el sistema por sí solo: nadie las decide a mano.
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  contenedor: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  centro: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  falloTexto: { color: '#555', fontSize: 15, textAlign: 'center' },
  reintentar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  reintentarTexto: { color: '#007AFF', fontWeight: '600' },
  desactualizado: { fontSize: 12, color: '#8F5600', marginBottom: 10 },
  estado: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 14, padding: 16 },
  estadoCuerpo: { flex: 1, gap: 4 },
  estadoTitulo: { fontSize: 18, fontWeight: '700' },
  estadoDetalle: { fontSize: 14, color: '#444', lineHeight: 20 },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 26,
    marginBottom: 8,
  },
  bloque: { borderRadius: 12, borderWidth: 1, borderColor: '#eee', paddingHorizontal: 14 },
  separada: { borderTopWidth: 1, borderTopColor: '#f2f2f2' },
  funcion: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  funcionTexto: { flex: 1, fontSize: 15, color: '#1a1a1a' },
  funcionEstado: { fontSize: 13, color: '#0E7247', fontWeight: '600' },
  funcionRestringida: { color: '#B32C24' },
  falta: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12 },
  faltaCuerpo: { flex: 1, gap: 2 },
  faltaFecha: { fontSize: 15, fontWeight: '600', color: '#1a1a1a' },
  faltaDetalle: { fontSize: 13, color: '#666' },
  nota: { fontSize: 12, color: '#888', marginTop: 8 },
  escalera: { gap: 0 },
  paso: { flexDirection: 'row', gap: 12 },
  pasoGuia: { alignItems: 'center', width: 28 },
  pasoPunto: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#EFEFF0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pasoNumero: { fontSize: 13, fontWeight: '700', color: '#8E8E93' },
  pasoNumeroActual: { color: '#fff' },
  pasoLinea: { flex: 1, width: 2, backgroundColor: '#EFEFF0', marginVertical: 2 },
  pasoCuerpo: { flex: 1, paddingBottom: 18, gap: 3 },
  pasoTitulo: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', marginTop: 4 },
  pasoDetalle: { fontSize: 13, color: '#666', lineHeight: 19 },
  pie: { fontSize: 12, color: '#888', lineHeight: 18, marginTop: 8 },
});

export { MiSituacionScreen };
