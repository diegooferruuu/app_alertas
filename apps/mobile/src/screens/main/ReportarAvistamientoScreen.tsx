import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { enviarImagenPorWhatsApp } from '../../services/whatsapp';
import { TarjetaDeReporte } from '../../components/TarjetaDeReporte';
import { SelectorDeUbicacion, Coordenadas } from '../../components/SelectorDeUbicacion';
import { OpcionRadio } from '../../components/OpcionRadio';
import avistamientoService, {
  CanalAvistamiento,
  ContactoAutoridad,
} from '../../services/avistamiento.service';
import { API_URL } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
  DatosDelReporte,
  FRANJAS,
  FranjaAvistamiento,
  armarReporte,
  enlaceDeFicha,
  enlaceDeLlamada,
  quienReporta,
  textoDeAcompanamiento,
} from '../../utils/reporte-avistamiento';

/** Lo que la pantalla necesita de la alerta. Viene del detalle ya cargado. */
interface AlertaVista {
  id: string;
  nombre_persona_buscada: string | null;
  /** La descripción física en una línea, ya armada por el detalle. */
  descripcion?: string | null;
}

/**
 * Cada cuánto se rehace el reporte en pantalla. Muestra horas al minuto, así
 * que la imagen que sale nunca se atrasa más que esto respecto del envío.
 */
const REFRESCO_MS = 10_000;

/**
 * «Vi a esta persona»: arma un reporte para la Policía y ayuda a entregarlo.
 *
 * El reporte se arma y se entrega en el teléfono, y su contenido nunca llega
 * al servidor (I2): ni dónde, ni cuándo, ni quién. Lo único que se le cuenta
 * es qué botón se tocó, sin saber quién lo tocó. Solo dos datos estructurados
 * —lugar y franja—, sin texto libre ni fotos.
 *
 * Lleva el nombre de quien reporta, que la autoridad igual identifica por su
 * número. Por WhatsApp va como imagen, que no se puede editar antes de
 * enviarla, con un texto corto que trae el enlace a la ficha pública de la
 * alerta, donde está la foto. Sin firma: el reporte es un aviso a la Policía,
 * que lo comprueba con sus propios medios.
 *
 * No se restringe por sanciones: avisar a la Policía no usa la credibilidad
 * del sistema, e impedirlo solo perjudicaría a la persona que se busca.
 */
const ReportarAvistamientoScreen: React.FC<{ route: any }> = ({ route }) => {
  const alerta: AlertaVista = route.params.alerta;
  const { user } = useAuth();
  const [punto, setPunto] = useState<Coordenadas | null>(null);
  const [calle, setCalle] = useState<string | null>(null);
  const [franja, setFranja] = useState<FranjaAvistamiento | null>(null);
  const [contacto, setContacto] = useState<ContactoAutoridad | null>(null);
  const [cargandoContacto, setCargandoContacto] = useState(true);
  const [abriendo, setAbriendo] = useState<CanalAvistamiento | null>(null);
  const [ahora, setAhora] = useState(() => new Date());
  const tarjeta = useRef<View>(null);

  // Las horas del reporte se cuentan desde el envío, no desde que se abrió la
  // pantalla: se rehace solo, y lo que se captura es lo que está a la vista.
  useEffect(() => {
    const reloj = setInterval(() => setAhora(new Date()), REFRESCO_MS);
    return () => clearInterval(reloj);
  }, []);

  const cargarContacto = useCallback(async () => {
    setCargandoContacto(true);
    setContacto(await avistamientoService.contacto());
    setCargandoContacto(false);
  }, []);

  useEffect(() => {
    cargarContacto();
  }, [cargarContacto]);

  // La calle la averigua el teléfono con el geocodificador del sistema, sin
  // pasar por el servidor. Es opcional: si falla, el enlace del mapa basta.
  useEffect(() => {
    if (!punto) return;
    let vigente = true;
    setCalle(null);
    Location.reverseGeocodeAsync({ latitude: punto.lat, longitude: punto.lng })
      .then(([lugar]) => {
        if (vigente) setCalle(lugar?.street ?? null);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [punto]);

  const datos: DatosDelReporte | null =
    punto && franja
      ? {
          denunciaId: alerta.id,
          nombre: alerta.nombre_persona_buscada,
          descripcion: alerta.descripcion ?? null,
          punto,
          calle,
          franja,
          ahora,
          reporta: user ? quienReporta(user) : null,
          ficha: enlaceDeFicha(API_URL, alerta.id),
        }
      : null;
  const reporte = datos ? armarReporte(datos) : null;

  const llamar = async () => {
    if (!contacto) return;
    setAbriendo('LLAMADA');
    try {
      await Linking.openURL(enlaceDeLlamada(contacto.telefono));
    } catch {
      Alert.alert('No se pudo abrir', `Llama al ${contacto.telefono} y lee el reporte.`);
      return;
    } finally {
      setAbriendo(null);
    }
    // Primero el canal, después la métrica: su fallo no puede afectar al reporte.
    avistamientoService.registrarUso(alerta.id, 'LLAMADA').catch(() => {});
  };

  /**
   * Manda la tarjeta de la pantalla como imagen.
   *
   * En Android va directo al chat de la autoridad con la imagen y el texto
   * adjuntos. Donde eso no se puede —iOS, o un teléfono sin WhatsApp— se abre
   * el menú de compartir del sistema con la imagen, y la persona elige el chat.
   * La imagen se arma y se queda en el teléfono: al servidor no llega (I2).
   */
  const enviarPorWhatsApp = async () => {
    const numero = contacto?.mensajeria;
    if (!numero || !datos) return;
    setAbriendo('MENSAJE');
    try {
      const imagen = await captureRef(tarjeta, { format: 'png', quality: 1, result: 'tmpfile' });
      // Si el atajo falla por lo que sea, queda el menú de compartir: la imagen
      // ya está hecha y no hay por qué perder el reporte.
      const abierto = await enviarImagenPorWhatsApp(
        imagen,
        textoDeAcompanamiento(datos),
        numero,
      ).catch(() => false);
      if (!abierto) {
        if (!(await Sharing.isAvailableAsync())) throw new Error('Sin menú de compartir');
        await new Promise<void>((seguir) =>
          Alert.alert(
            'Elige WhatsApp',
            `Se abrirá el menú para compartir la imagen. Elige WhatsApp y el chat del +${numero}.`,
            [{ text: 'Continuar', onPress: () => seguir() }],
            { cancelable: false },
          ),
        );
        await Sharing.shareAsync(imagen, { mimeType: 'image/png', dialogTitle: 'Enviar el reporte' });
      }
    } catch {
      Alert.alert(
        'No se pudo enviar',
        'Comprueba que WhatsApp esté instalado, o llama y lee el reporte.',
      );
      return;
    } finally {
      setAbriendo(null);
    }
    avistamientoService.registrarUso(alerta.id, 'MENSAJE').catch(() => {});
  };

  return (
    <ScrollView contentContainerStyle={estilos.contenedor} keyboardShouldPersistTaps="handled">
      <Text style={estilos.titulo}>Vi a esta persona</Text>
      <Text style={estilos.subtitulo}>
        Arma un reporte para la Policía sobre {alerta.nombre_persona_buscada || 'la persona buscada'}.
        Lo entregas tú, con una llamada o un mensaje.
      </Text>

      <SelectorDeUbicacion valor={punto} onChange={setPunto} modo="avistamiento" />
      {calle ? <Text style={estilos.calle}>Calle más cercana: {calle}</Text> : null}

      <Text style={estilos.pregunta}>¿Cuándo la viste?</Text>
      <View style={estilos.grupo} accessibilityRole="radiogroup">
        {FRANJAS.map((f) => (
          <OpcionRadio
            key={f.valor}
            elegida={franja === f.valor}
            onPress={() => setFranja(f.valor)}
            titulo={f.etiqueta}
          />
        ))}
      </View>

      {reporte ? (
        <>
          <Text style={estilos.seccion}>Tu reporte</Text>
          <TarjetaDeReporte ref={tarjeta} reporte={reporte} />
          <Text style={estilos.ayuda}>
            Por WhatsApp se envía esta misma imagen. Durante la llamada puedes volver a esta
            pantalla para leerla.
          </Text>
        </>
      ) : (
        <Text style={estilos.ayuda}>Elige dónde y cuándo la viste para armar el reporte.</Text>
      )}

      {cargandoContacto ? (
        <ActivityIndicator style={estilos.cargando} color="#007AFF" />
      ) : contacto ? (
        <View style={estilos.acciones}>
          <TouchableOpacity
            style={[estilos.llamar, (!reporte || abriendo !== null) && estilos.desactivado]}
            disabled={!reporte || abriendo !== null}
            onPress={llamar}
          >
            <Ionicons name="call" size={18} color="#fff" />
            <Text style={estilos.llamarTexto}>Llamar al {contacto.telefono}</Text>
          </TouchableOpacity>
          {contacto.mensajeria ? (
            <TouchableOpacity
              style={[estilos.mensaje, (!reporte || abriendo !== null) && estilos.mensajeDesactivado]}
              disabled={!reporte || abriendo !== null}
              onPress={enviarPorWhatsApp}
            >
              <Ionicons name="logo-whatsapp" size={18} color="#0E7247" />
              <Text style={estilos.mensajeTexto}>Enviar por WhatsApp</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <View style={estilos.aviso}>
          <Ionicons name="cloud-offline-outline" size={18} color="#8F5600" />
          <Text style={estilos.avisoTexto}>
            No se pudo obtener el número de la autoridad. Revisa tu conexión.
          </Text>
          <TouchableOpacity onPress={cargarContacto}>
            <Text style={estilos.reintentar}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={estilos.privacidad}>
        El reporte se arma en tu teléfono y va de ahí a la Policía; la aplicación no lo guarda:
        solo cuenta, sin saber quién, que se usó un botón. Lleva tu nombre, y por WhatsApp va
        como imagen, que no se puede editar antes de enviarla, con un enlace a la ficha de la
        persona, que deja de mostrarse si la alerta se retira. El nombre de la calle lo averigua
        tu teléfono con su servicio de mapas
        {contacto?.mensajeria ? ', y el mensaje pasa por WhatsApp' : ''}.
      </Text>
    </ScrollView>
  );
};

const estilos = StyleSheet.create({
  contenedor: { padding: 20, backgroundColor: '#fff', flexGrow: 1 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 6 },
  subtitulo: { fontSize: 14, color: '#666', lineHeight: 20 },
  calle: { fontSize: 13, color: '#2C6B3F', marginTop: 8 },
  pregunta: { fontSize: 16, fontWeight: '700', color: '#1a1a1a', marginTop: 24, marginBottom: 10 },
  grupo: { gap: 8 },
  seccion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginTop: 24,
    marginBottom: 8,
  },
  ayuda: { fontSize: 12, color: '#888', marginTop: 8, lineHeight: 17 },
  cargando: { marginTop: 24 },
  acciones: { gap: 10, marginTop: 20 },
  llamar: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 12,
    backgroundColor: '#0E7247',
  },
  llamarTexto: { color: '#fff', fontSize: 16, fontWeight: '700' },
  desactivado: { backgroundColor: '#c3c9d6' },
  mensaje: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#0E7247',
  },
  mensajeDesactivado: { borderColor: '#c3c9d6', opacity: 0.6 },
  mensajeTexto: { color: '#0E7247', fontSize: 15, fontWeight: '700' },
  aviso: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#F9EEDA',
    borderRadius: 10,
    padding: 14,
    marginTop: 20,
  },
  avisoTexto: { flex: 1, fontSize: 13, color: '#6B4300', lineHeight: 19 },
  reintentar: { color: '#007AFF', fontWeight: '700', fontSize: 14 },
  privacidad: { fontSize: 12, color: '#888', lineHeight: 18, marginTop: 20 },
});

export { ReportarAvistamientoScreen };
