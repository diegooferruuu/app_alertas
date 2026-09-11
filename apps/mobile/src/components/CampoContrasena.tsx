import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface Props extends Omit<TextInputProps, 'secureTextEntry'> {
  /** Etiqueta del botón para lectores de pantalla; distingue los dos campos. */
  etiquetaVisibilidad?: string;
}

/**
 * Campo de contraseña con el ojito para ver lo escrito.
 *
 * Poder leer lo tecleado no debilita nada aquí: el riesgo de que alguien mire la
 * pantalla es menor que el de crear una cuenta con una contraseña que no es la
 * que se creyó escribir, y de la que no hay forma de volver. Empieza siempre
 * oculto, y cada campo gestiona su propia visibilidad: destapar la contraseña no
 * destapa la confirmación, que es justo lo que la hace servir de comprobación.
 */
export const CampoContrasena: React.FC<Props> = ({
  etiquetaVisibilidad = 'Mostrar u ocultar la contraseña',
  style,
  ...props
}) => {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.contenedor}>
      <TextInput
        {...props}
        style={[styles.input, style]}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        // Los dos campos se declaran como contraseña nueva, que es lo que son.
        // Declararlos así —y no intentar que el sistema no los toque— es lo que
        // hace que iOS los trate como un par y escriba el mismo valor en ambos
        // si la persona acepta su contraseña generada. Con la declaración a
        // medias, el sistema llenaba solo uno y el aviso de contraseñas
        // distintas aparecía con el campo aparentemente vacío.
        textContentType="newPassword"
        autoComplete="new-password"
      />
      <TouchableOpacity
        style={styles.ojito}
        onPress={() => setVisible((estaVisible) => !estaVisible)}
        accessibilityRole="button"
        accessibilityLabel={etiquetaVisibilidad}
        // El dedo tapa un icono pequeño; se amplía el área sensible sin agrandarlo.
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
      >
        <Ionicons
          name={visible ? 'eye-off-outline' : 'eye-outline'}
          size={22}
          color="#666"
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  contenedor: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    // Deja sitio al icono para que el texto largo no pase por debajo.
    paddingRight: 48,
    marginBottom: 15,
    borderRadius: 8,
    fontSize: 16,
  },
  ojito: {
    position: 'absolute',
    right: 12,
    // Compensa el `marginBottom` del campo para quedar centrado sobre el texto.
    top: 0,
    bottom: 15,
    justifyContent: 'center',
  },
});
