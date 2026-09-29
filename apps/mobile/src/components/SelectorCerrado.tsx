import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { Opcion } from '../screens/main/catalogo-denuncia';

/**
 * Elegir de una lista, no escribir.
 *
 * Es la forma que toma en pantalla la decisión de fondo del formulario: no hay
 * campo libre donde quepa una acusación, un nombre de tercero o un rumor. Por
 * eso no existe una variante «Otro, especificar»: reabriría exactamente la
 * puerta que el dominio cerrado existe para clausurar. Cuando una lista se queda
 * corta, la respuesta es añadir un valor al dominio, no un campo de texto.
 */

interface PropsUnico {
  etiqueta: string;
  opciones: Opcion[];
  valor: string | null;
  onChange: (valor: string) => void;
  /** Se muestra bajo el control, para lo que la etiqueta no alcanza a decir. */
  ayuda?: string;
  opcional?: boolean;
}

export const SelectorCerrado: React.FC<PropsUnico> = ({
  etiqueta,
  opciones,
  valor,
  onChange,
  ayuda,
  opcional = false,
}) => {
  const [abierto, setAbierto] = useState(false);
  const elegida = opciones.find((o) => o.valor === valor);

  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>
        {etiqueta}
        {opcional && <Text style={styles.opcional}> (opcional)</Text>}
      </Text>

      <TouchableOpacity
        style={styles.control}
        onPress={() => setAbierto(true)}
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}. ${elegida?.etiqueta ?? 'Sin elegir'}`}
      >
        <Text style={elegida ? styles.valor : styles.marcador}>
          {elegida?.etiqueta ?? 'Elegir…'}
        </Text>
        <Text style={styles.chevron}>▾</Text>
      </TouchableOpacity>

      {ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}

      <Modal
        visible={abierto}
        transparent
        animationType="slide"
        onRequestClose={() => setAbierto(false)}
      >
        <TouchableOpacity
          style={styles.fondo}
          activeOpacity={1}
          onPress={() => setAbierto(false)}
        >
          <View style={styles.hoja}>
            <Text style={styles.tituloHoja}>{etiqueta}</Text>
            <ScrollView style={styles.lista}>
              {opciones.map((opcion) => (
                <TouchableOpacity
                  key={opcion.valor}
                  style={styles.opcion}
                  onPress={() => {
                    onChange(opcion.valor);
                    setAbierto(false);
                  }}
                >
                  <Text
                    style={[
                      styles.opcionTexto,
                      opcion.valor === valor && styles.opcionElegida,
                    ]}
                  >
                    {opcion.etiqueta}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

interface PropsMultiple {
  etiqueta: string;
  opciones: Opcion[];
  valores: string[];
  onChange: (valores: string[]) => void;
  ayuda?: string;
}

/**
 * Varias opciones a la vez, como fichas que se encienden.
 *
 * Se muestran todas en pantalla en vez de esconderlas tras un modal: son listas
 * cortas y quien reporta necesita ver de un vistazo qué puede marcar, no
 * descubrirlo abriendo algo.
 */
export const SelectorMultiple: React.FC<PropsMultiple> = ({
  etiqueta,
  opciones,
  valores,
  onChange,
  ayuda,
}) => {
  const alternar = (valor: string) =>
    onChange(
      valores.includes(valor)
        ? valores.filter((v) => v !== valor)
        : [...valores, valor],
    );

  return (
    <View style={styles.campo}>
      <Text style={styles.etiqueta}>
        {etiqueta}
        <Text style={styles.opcional}> (opcional)</Text>
      </Text>

      <View style={styles.fichas}>
        {opciones.map((opcion) => {
          const activa = valores.includes(opcion.valor);
          return (
            <TouchableOpacity
              key={opcion.valor}
              style={[styles.ficha, activa && styles.fichaActiva]}
              onPress={() => alternar(opcion.valor)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: activa }}
            >
              <Text style={[styles.fichaTexto, activa && styles.fichaTextoActivo]}>
                {opcion.etiqueta}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {ayuda ? <Text style={styles.ayuda}>{ayuda}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  campo: { marginTop: 16 },
  etiqueta: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  opcional: { fontWeight: '400', color: '#888' },
  control: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: '#fafafa',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  valor: { fontSize: 15, color: '#1a1a1a' },
  marcador: { fontSize: 15, color: '#999' },
  chevron: { fontSize: 14, color: '#666' },
  ayuda: { fontSize: 12, color: '#888', marginTop: 6, lineHeight: 17 },
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  hoja: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  tituloHoja: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
    color: '#1a1a1a',
  },
  lista: { flexGrow: 0 },
  opcion: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  opcionTexto: { fontSize: 16, color: '#333', textAlign: 'center' },
  opcionElegida: { color: '#007AFF', fontWeight: '700' },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ficha: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#fafafa',
  },
  fichaActiva: { borderColor: '#007AFF', backgroundColor: '#eaf3ff' },
  fichaTexto: { fontSize: 14, color: '#444' },
  fichaTextoActivo: { color: '#007AFF', fontWeight: '600' },
});
