import React, { forwardRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Reporte } from '../utils/reporte-avistamiento';

/**
 * El reporte de avistamiento tal como lo recibe la Policía.
 *
 * Es la misma vista la que se muestra en pantalla —para leerla durante una
 * llamada— y la que se convierte en imagen para WhatsApp: lo que se ve es lo que
 * se envía, sin una segunda versión que pudiera diferir.
 *
 * Colores fijos y fondo blanco explícito: la imagen tiene que leerse igual en el
 * teléfono de quien la recibe, sea cual sea el tema del de quien la envía.
 * `collapsable={false}` es para Android, que de otro modo puede quitar la vista
 * del árbol nativo y dejar la captura sin nada que fotografiar.
 */
export const TarjetaDeReporte = forwardRef<View, { reporte: Reporte }>(({ reporte }, ref) => (
  <View ref={ref} collapsable={false} style={estilos.tarjeta}>
    <View style={estilos.banda}>
      <Text style={estilos.titulo}>{reporte.titulo}</Text>
      <Text style={estilos.subtitulo}>{reporte.subtitulo}</Text>
    </View>
    <View style={estilos.cuerpo}>
      {reporte.filas.map((fila) => (
        <View key={fila.etiqueta} style={estilos.fila}>
          <Text style={estilos.etiqueta}>{fila.etiqueta}</Text>
          <Text style={estilos.valor}>{fila.valor}</Text>
        </View>
      ))}
    </View>
    <Text style={estilos.pie}>{reporte.generado}</Text>
  </View>
));
TarjetaDeReporte.displayName = 'TarjetaDeReporte';

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D9DDE3',
    overflow: 'hidden',
  },
  banda: { backgroundColor: '#0E7247', paddingHorizontal: 16, paddingVertical: 12 },
  titulo: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  subtitulo: { color: '#D7F0E3', fontSize: 13, marginTop: 2 },
  cuerpo: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  fila: { gap: 2 },
  etiqueta: {
    color: '#5B6470',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  valor: { color: '#14181F', fontSize: 15, lineHeight: 21 },
  pie: {
    color: '#5B6470',
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
});
