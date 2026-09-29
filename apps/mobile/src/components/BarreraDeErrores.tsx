import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';

/**
 * Última red bajo el árbol de componentes.
 *
 * Sin una barrera, un error lanzado en el render o en un efecto no tiene quién
 * lo atrape: React desmonta la aplicación entera y queda una pantalla muerta,
 * sin texto ni forma de saber qué pasó. En desarrollo al menos hay caja roja;
 * en un teléfono con la aplicación instalada no hay nada.
 *
 * Esto no arregla el fallo, lo hace visible. La diferencia entre «se quedó
 * colgado» y «dice exactamente qué reventó» es la diferencia entre media hora
 * de tanteo y una línea de registro.
 *
 * Tiene que ser una clase: `componentDidCatch` no existe como hook.
 */
interface Props {
  children: React.ReactNode;
}

interface Estado {
  error: Error | null;
}

export class BarreraDeErrores extends React.Component<Props, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Al registro además de a la pantalla: en el teléfono de otra persona la
    // pantalla es lo único que hay, pero durante el desarrollo el registro es
    // donde se lee cómodo.
    console.error('La aplicación se detuvo:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={estilos.fondo}>
        <ScrollView contentContainerStyle={estilos.contenido}>
          <Text style={estilos.titulo}>La aplicación se detuvo</Text>
          <Text style={estilos.ayuda}>
            Algo falló y no se pudo continuar. Si estás probando, este texto es
            lo que hace falta para saber qué pasó.
          </Text>

          <View style={estilos.caja}>
            <Text style={estilos.mensaje}>{error.message || String(error)}</Text>
          </View>

          <TouchableOpacity
            style={estilos.boton}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={estilos.botonTexto}>Reintentar</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: '#fff' },
  contenido: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 14 },
  titulo: { fontSize: 22, fontWeight: 'bold', color: '#1a1a1a' },
  ayuda: { fontSize: 14, lineHeight: 20, color: '#666' },
  caja: {
    backgroundColor: '#FFF4F3',
    borderWidth: 1,
    borderColor: '#F0C9C5',
    borderRadius: 10,
    padding: 14,
  },
  mensaje: { fontSize: 13, lineHeight: 19, color: '#B32C24' },
  boton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
