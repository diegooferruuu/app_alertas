import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Requisito } from '../utils/contrasena';

/**
 * Los requisitos de la contraseña, en rojo hasta que se cumplen y en verde
 * después. Van a la vista mientras se escribe: así el botón apagado se explica
 * solo, en vez de un rechazo del servidor después de enviar.
 *
 * Cada fila lleva icono además de color: quien no distingue el rojo del verde
 * ve igual una cruz o una marca.
 */
export const RequisitosContrasena: React.FC<{ requisitos: Requisito[] }> = ({ requisitos }) => (
  <View style={styles.lista} accessibilityRole="summary">
    {requisitos.map((r) => (
      <View
        key={r.clave}
        style={styles.fila}
        accessible
        accessibilityLabel={`${r.texto}: ${r.cumplido ? 'cumplido' : 'falta'}`}
      >
        <Ionicons
          name={r.cumplido ? 'checkmark-circle' : 'close-circle'}
          size={18}
          color={r.cumplido ? COLOR_CUMPLIDO : COLOR_FALTA}
        />
        <Text style={[styles.texto, { color: r.cumplido ? COLOR_CUMPLIDO : COLOR_FALTA }]}>
          {r.texto}
        </Text>
      </View>
    ))}
  </View>
);

// Más oscuros que el rojo y el verde de iOS para que el texto pequeño se lea
// sobre blanco.
const COLOR_CUMPLIDO = '#1E7D34';
const COLOR_FALTA = '#D70015';

const styles = StyleSheet.create({
  lista: { gap: 6, marginBottom: 14 },
  fila: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  texto: { fontSize: 14 },
});
