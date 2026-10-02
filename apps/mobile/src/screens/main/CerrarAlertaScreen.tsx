import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import cierreService, {
  DenunciaQueMeIdentifica,
  TipoCierre,
} from '../../services/cierre.service';
import { rechazoDe } from '../../services/restricciones';
import { OpcionRadio as Opcion } from '../../components/OpcionRadio';

/**
 * Cerrar una alerta que identifica a quien la ejecuta.
 *
 * Son dos cierres con efectos distintos sobre quien denunció, y la diferencia
 * tiene que quedar clara antes de elegir: «Estoy bien» no sanciona a nadie;
 * «Esta denuncia es falsa» deja una falta que no vence. Por eso es una pantalla
 * y no un diálogo: una decisión que afecta a otra persona de forma permanente
 * merece leerse.
 *
 * Con «Estoy bien» se pregunta además si quien denunció podrá volver a hacerlo,
 * **sin respuesta marcada**: si la persona no contesta, no se supone nada, y el
 * servidor rechaza el cierre sin esa respuesta.
 *
 * Como en el resto del flujo, no se muestra nada de quien denunció (I8).
 */
const CerrarAlertaScreen: React.FC<{ route: any; navigation: any }> = ({
  route,
  navigation,
}) => {
  const alerta: DenunciaQueMeIdentifica = route.params.alerta;
  // Quien la presentó ya la dio por terminada: no se difunde, pero se responde igual.
  const terminada = alerta.estado === 'CERRADA';
  const [tipo, setTipo] = useState<TipoCierre | null>(null);
  const [podraVolver, setPodraVolver] = useState<boolean | null>(null);
  const [enviando, setEnviando] = useState(false);

  const completo = tipo === 'CON_SANCION' || (tipo === 'SIN_SANCION' && podraVolver !== null);

  const elegirTipo = (nuevo: TipoCierre) => {
    setTipo(nuevo);
    // La respuesta sobre volver a denunciar solo existe con «Estoy bien».
    if (nuevo === 'CON_SANCION') setPodraVolver(null);
  };

  const cerrar = async () => {
    setEnviando(true);
    try {
      const resultado = await cierreService.cerrar(alerta.id, {
        tipo: tipo!,
        ...(tipo === 'SIN_SANCION' ? { bloquear_nueva_denuncia: !podraVolver } : {}),
      });
      Alert.alert('Alerta cerrada', resultado.mensaje, [
        { text: 'Entendido', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const rechazo = rechazoDe(err, {
        titulo: 'No se pudo cerrar',
        mensaje: 'No se pudo cerrar la alerta. Inténtalo de nuevo.',
      });
      Alert.alert(rechazo.titulo, rechazo.mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const confirmar = () => {
    const efecto =
      tipo === 'CON_SANCION'
        ? 'Quien la presentó recibirá una falta permanente y no podrá volver a denunciarte.'
        : podraVolver
          ? 'Quien la presentó no recibe ninguna sanción y podrá volver a denunciarte.'
          : 'Quien la presentó no recibe ninguna sanción, pero no podrá volver a denunciarte.';
    Alert.alert(
      terminada ? '¿Registrar tu respuesta?' : '¿Cerrar la alerta?',
      `${terminada ? '' : 'Dejará de difundirse de inmediato. '}${efecto}\n\nNo se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: terminada ? 'Registrar' : 'Cerrar la alerta', style: 'destructive', onPress: cerrar },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.contenedor}>
      <Text style={styles.titulo}>
        {terminada ? 'Responder a esta denuncia' : 'Cerrar la alerta'}
      </Text>
      <Text style={styles.subtitulo}>
        Sobre {alerta.nombre_persona_buscada || 'ti'}.{' '}
        {terminada
          ? 'Quien la presentó ya la dio por terminada y no se difunde. Igual puedes decir si estás bien o si era falsa.'
          : 'Dejará de difundirse de inmediato y no podrá volver a activarse.'}
      </Text>

      <Text style={styles.pregunta}>¿Por qué la cierras?</Text>
      <View style={styles.grupo} accessibilityRole="radiogroup">
        <Opcion
          elegida={tipo === 'SIN_SANCION'}
          onPress={() => elegirTipo('SIN_SANCION')}
          titulo="Estoy bien"
          detalle="Volví, me encontraron, o quien me reportó se preocupó de buena fe."
          consecuencia="Quien la presentó no recibe ninguna sanción."
          icono="happy-outline"
          color="#0E7247"
        />
        <Opcion
          elegida={tipo === 'CON_SANCION'}
          onPress={() => elegirTipo('CON_SANCION')}
          titulo="Esta denuncia es falsa"
          detalle="Nadie tenía motivos reales para reportarme como desaparecido."
          consecuencia="Quien la presentó recibe una falta permanente y no podrá volver a denunciarte."
          icono="warning-outline"
          color="#B32C24"
        />
      </View>

      {tipo === 'SIN_SANCION' && (
        <>
          <Text style={styles.pregunta}>
            Si algún día desaparecieras de verdad, ¿podrá volver a denunciarte quien presentó esta
            denuncia?
          </Text>
          <View style={styles.grupo} accessibilityRole="radiogroup">
            <Opcion
              elegida={podraVolver === true}
              onPress={() => setPodraVolver(true)}
              titulo="Sí, podrá denunciarme"
              detalle="Si es alguien cercano, puede ser quien primero note tu ausencia."
              icono="person-circle-outline"
              color="#1B44BB"
            />
            <Opcion
              elegida={podraVolver === false}
              onPress={() => setPodraVolver(false)}
              titulo="No, no podrá denunciarme"
              detalle="Si lo intenta, se le rechazará sin decirle cuál de las dos opciones elegiste."
              icono="hand-left-outline"
              color="#1B44BB"
            />
          </View>
        </>
      )}

      {tipo === 'CON_SANCION' && (
        <View style={styles.aviso}>
          <Ionicons name="information-circle-outline" size={18} color="#8F5600" />
          <Text style={styles.avisoTexto}>
            Úsala solo si la denuncia es falsa. Si alguien te reportó de buena fe —un familiar
            preocupado, por ejemplo—, elige «Estoy bien»: la falta no vence. Si dos personas
            distintas declaran falsas las denuncias de alguien, su cuenta se suspende.
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.boton, (!completo || enviando) && styles.botonDeshabilitado]}
        disabled={!completo || enviando}
        onPress={confirmar}
      >
        {enviando ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.botonTexto}>
            {terminada ? 'Registrar mi respuesta' : 'Cerrar la alerta'}
          </Text>
        )}
      </TouchableOpacity>

      {/* Sin firma no hay declaración jurada, y sin ella no hay constancia. */}
      {alerta.nivel_confianza !== 'REGISTRADA' && (
        <Text style={styles.pie}>
          Podrás pedir después la constancia de esta denuncia, con la identidad de quien la firmó.
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  contenedor: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#666', lineHeight: 20, marginBottom: 8 },
  pregunta: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 20,
    marginBottom: 10,
    lineHeight: 22,
  },
  grupo: { gap: 10 },
  aviso: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: '#F9EEDA',
    borderRadius: 10,
    padding: 14,
    marginTop: 16,
  },
  avisoTexto: { flex: 1, fontSize: 13, color: '#6B4300', lineHeight: 19 },
  boton: {
    backgroundColor: '#B32C24',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  botonDeshabilitado: { backgroundColor: '#c3c9d6' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  pie: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 14, lineHeight: 17 },
});

export { CerrarAlertaScreen };
