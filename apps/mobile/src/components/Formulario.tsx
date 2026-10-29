import React, { forwardRef } from 'react';
import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
  KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

/**
 * Espacio entre el teclado y el cursor del campo enfocado. Alcanza para ver el
 * campo entero y lo que se escribe debajo de él, como el aviso de un error.
 */
const ESPACIO_SOBRE_EL_TECLADO = 48;

/**
 * El contenedor de toda pantalla con campos de texto: se desplaza para que el
 * campo enfocado quede siempre por encima del teclado.
 *
 * Un `ScrollView` no basta. En Android la app dibuja de borde a borde (Expo lo
 * impone desde la SDK 54), y así `softwareKeyboardLayoutMode: "resize"` ya no
 * achica la pantalla de forma fiable: en los formularios largos el teclado
 * tapaba a veces el campo en el que se escribía. En iOS el sistema no desplaza
 * nada por su cuenta. `KeyboardAwareScrollView` mide el teclado en los dos y
 * lleva el campo a la vista, también al pasar de uno a otro.
 *
 * Con el teclado abierto, un botón responde al primer toque en vez de solo
 * cerrar el teclado.
 */
export const Formulario = forwardRef<KeyboardAwareScrollViewRef, KeyboardAwareScrollViewProps>(
  (props, ref) => (
    <KeyboardAwareScrollView
      ref={ref}
      keyboardShouldPersistTaps="handled"
      bottomOffset={ESPACIO_SOBRE_EL_TECLADO}
      {...props}
    />
  ),
);
Formulario.displayName = 'Formulario';
