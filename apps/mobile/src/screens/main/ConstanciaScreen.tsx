import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Constancia } from '../../services/constancia.service';

const ETIQUETA_TIPO: Record<string, string> = {
  original: 'Presentó la denuncia',
  corroboracion: 'Corroboró la denuncia',
};

/**
 * La constancia probatoria (§6).
 *
 * Es la única pantalla del sistema que revela la identidad de quien denunció, y
 * solo se llega aquí pidiéndola de forma deliberada. El fundamento es directo:
 * quien denunció aceptó la atribución como condición para difundir. Es
 * exactamente lo que firmó.
 *
 * Se presenta sin adornos ni lenguaje acusatorio: es un documento, no una
 * acusación, y quien lo lee decide qué hacer con él.
 */
const ConstanciaScreen: React.FC<{ route: any }> = ({ route }) => {
  const constancia: Constancia = route.params.constancia;
  const sinFirmaCripto = constancia.firmantes.some(
    (f) => !f.con_firma_criptografica,
  );

  return (
    <ScrollView contentContainerStyle={styles.contenedor}>
      <Text style={styles.titulo}>Constancia de la denuncia</Text>
      <Text style={styles.emitida}>
        Emitida el {new Date(constancia.emitida_en).toLocaleString()}
      </Text>

      {constancia.alcance === 'propia_declaracion' && (
        <View style={styles.nota}>
          <Ionicons name="information-circle-outline" size={18} color="#1B44BB" />
          <Text style={styles.notaTexto}>
            Es la copia de tu propia declaración. No incluye la identidad de
            otras personas que hayan firmado sobre este caso.
          </Text>
        </View>
      )}

      <Text style={styles.seccion}>La denuncia</Text>
      <View style={styles.bloque}>
        <Text style={styles.dato}>
          {constancia.denuncia.nombre_persona_buscada || 'Sin nombre'}
        </Text>
        <Text style={styles.descripcion}>{constancia.denuncia.description}</Text>
        <Text style={styles.meta}>
          Presentada el{' '}
          {new Date(constancia.denuncia.created_at).toLocaleDateString()} ·{' '}
          {constancia.denuncia.estado}
        </Text>
      </View>

      <Text style={styles.seccion}>
        {constancia.firmantes.length === 1
          ? 'Quién la firmó'
          : 'Quiénes la firmaron'}
      </Text>

      {constancia.firmantes.map((f, i) => (
        <View key={i} style={styles.bloque}>
          <Text style={styles.nombre}>{f.nombre}</Text>
          <Text style={styles.rol}>
            {ETIQUETA_TIPO[f.tipo] ?? f.tipo} · declaró ser {f.vinculo_declarado}
          </Text>

          <Text style={styles.etiqueta}>Documento (SHA-256)</Text>
          {/* El número nunca se almacenó en claro. No es una carencia: quien
              tenga delante el documento puede aplicarle SHA-256 y comparar. */}
          <Text style={styles.hash}>{f.ci_hash}</Text>

          <Text style={styles.etiqueta}>Escribió al firmar</Text>
          <Text style={styles.frase}>«{f.texto_firmado}»</Text>

          <Text style={styles.meta}>
            Firmada el {new Date(f.firmada_en).toLocaleString()}
          </Text>

          <View style={styles.firmaFila}>
            <Ionicons
              name={f.con_firma_criptografica ? 'lock-closed' : 'lock-open-outline'}
              size={15}
              color={f.con_firma_criptografica ? '#0E7247' : '#8F5600'}
            />
            <Text
              style={[
                styles.firmaTexto,
                { color: f.con_firma_criptografica ? '#0E7247' : '#8F5600' },
              ]}
            >
              {f.con_firma_criptografica
                ? 'Con firma criptográfica del dispositivo'
                : 'Sin firma criptográfica del dispositivo'}
            </Text>
          </View>
        </View>
      ))}

      {sinFirmaCripto && (
        <View style={styles.advertencia}>
          <Ionicons name="alert-circle-outline" size={18} color="#8F5600" />
          <Text style={styles.advertenciaTexto}>
            Sin firma criptográfica, la integridad de este registro se apoya en la
            cadena de hashes que construye el propio servidor. Es verificable
            frente a alteraciones posteriores, pero no frente a quien lo opera.
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  contenedor: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  emitida: { fontSize: 12, color: '#999', marginTop: 4, marginBottom: 18 },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#999',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 8,
  },
  bloque: {
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#ECEEF2',
  },
  dato: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginBottom: 4 },
  descripcion: { fontSize: 14, color: '#444', lineHeight: 20, marginBottom: 8 },
  nombre: { fontSize: 19, fontWeight: 'bold', color: '#1a1a1a' },
  rol: { fontSize: 13, color: '#555', marginTop: 3, marginBottom: 12 },
  etiqueta: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8A93A3',
    textTransform: 'uppercase',
    marginTop: 8,
  },
  hash: { fontSize: 11, color: '#444', marginTop: 3, fontFamily: 'Courier' },
  frase: { fontSize: 15, color: '#1a1a1a', marginTop: 3, fontStyle: 'italic' },
  meta: { fontSize: 12, color: '#999', marginTop: 10 },
  firmaFila: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  firmaTexto: { fontSize: 12, fontWeight: '600' },
  nota: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#E7EDFC',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  notaTexto: { flex: 1, fontSize: 13, color: '#1B44BB', lineHeight: 18 },
  advertencia: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#F9EEDA',
    borderRadius: 10,
    padding: 14,
    marginTop: 4,
  },
  advertenciaTexto: { flex: 1, fontSize: 13, color: '#6B4300', lineHeight: 19 },
});

export { ConstanciaScreen };
