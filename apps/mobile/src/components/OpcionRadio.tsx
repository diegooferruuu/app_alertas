import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * Una opción de radio con su explicación.
 *
 * Las pantallas que la usan no marcan ninguna de antemano: son decisiones
 * —cerrar una alerta, cuándo se vio a alguien— en las que una respuesta por
 * defecto terminaría contestando por la persona.
 */
export const OpcionRadio: React.FC<{
  elegida: boolean;
  onPress: () => void;
  titulo: string;
  detalle?: string;
  consecuencia?: string;
  icono?: string;
  color?: string;
}> = ({ elegida, onPress, titulo, detalle, consecuencia, icono, color = '#007AFF' }) => (
  <TouchableOpacity
    style={[estilos.opcion, elegida && { borderColor: color, backgroundColor: `${color}0D` }]}
    onPress={onPress}
    accessibilityRole="radio"
    accessibilityState={{ checked: elegida }}
  >
    <Ionicons
      name={elegida ? 'radio-button-on' : 'radio-button-off'}
      size={22}
      color={elegida ? color : '#bbb'}
    />
    <View style={estilos.cuerpo}>
      <View style={estilos.tituloFila}>
        {icono ? <Ionicons name={icono as any} size={18} color={color} /> : null}
        <Text style={estilos.titulo}>{titulo}</Text>
      </View>
      {detalle ? <Text style={estilos.detalle}>{detalle}</Text> : null}
      {consecuencia ? (
        <Text style={[estilos.consecuencia, { color }]}>{consecuencia}</Text>
      ) : null}
    </View>
  </TouchableOpacity>
);

const estilos = StyleSheet.create({
  opcion: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e6e6e6',
  },
  cuerpo: { flex: 1, gap: 4 },
  tituloFila: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  titulo: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  detalle: { fontSize: 13, color: '#555', lineHeight: 19 },
  consecuencia: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginTop: 2 },
});
