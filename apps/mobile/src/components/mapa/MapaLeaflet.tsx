'use dom';

/**
 * Mapa Leaflet. Es un componente DOM de Expo: este archivo no corre en el motor
 * de React Native sino dentro de una webview, como una página. Lo que llega por
 * props viaja serializado, y `alTocar` es una función del lado nativo que se
 * invoca desde aquí.
 *
 * Solo lo usa Android; el porqué está en `Mapa.android.tsx`.
 */

// Al empaquetar, Metro avisa «Importing local resources in CSS is not supported
// yet» por las imágenes que este CSS referencia: el botón de capas y el ícono
// por defecto de los marcadores. Es esperable y no afecta: ninguno de los dos se
// usa, los marcadores de aquí son círculos dibujados.
import 'leaflet/dist/leaflet.css';
// Con `* as`: los tipos de Leaflet declaran exports con nombre, no uno por defecto.
import * as L from 'leaflet';
import { useEffect, useRef } from 'react';
import type { DOMProps } from 'expo/dom';
import type { MarcadorMapa, PuntoMapa, RegionMapa, ZonaMapa } from './tipos';

/**
 * CARTO sirve los datos de OpenStreetMap desde una red pensada para que la
 * consuman aplicaciones, sin clave. No se usa `tile.openstreetmap.org`: su
 * política exige identificar la aplicación, y a quien no lo hace le responde 403.
 * `{r}` pide la versión de doble resolución en pantallas que la necesitan.
 */
const TESELAS = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

/**
 * Sin enlaces a propósito: tocar un enlace navegaría la webview fuera del mapa.
 * La atribución la exigen la licencia de los datos (ODbL) y los términos de CARTO.
 */
const ATRIBUCION = '© OpenStreetMap · © CARTO';

/** Por debajo de 3 no hay nada útil, y por encima de 19 CARTO responde error. */
const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;

const AZUL = '#007AFF';

interface Props {
  region: RegionMapa;
  marcadores?: MarcadorMapa[];
  zona?: ZonaMapa | null;
  ubicacionUsuario?: PuntoMapa | null;
  alTocar?: (punto: PuntoMapa) => void;
  dom?: DOMProps;
}

/** Nivel de acercamiento de Leaflet que muestra, de lado a lado, esa amplitud en grados. */
const zoomPara = (longitudeDelta: number): number =>
  Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, Math.round(Math.log2(360 / longitudeDelta))));

/**
 * Contenido del globo de un marcador, armado con nodos y no con HTML: el
 * detalle es el nombre que escribió quien denunció, y como HTML podría inyectar
 * código en la página.
 */
const globo = (m: MarcadorMapa): HTMLElement => {
  const caja = document.createElement('div');
  const titulo = document.createElement('strong');
  titulo.textContent = m.titulo;
  caja.appendChild(titulo);
  if (m.detalle) {
    caja.appendChild(document.createElement('br'));
    caja.appendChild(document.createTextNode(m.detalle));
  }
  return caja;
};

export default function MapaLeaflet({
  region,
  marcadores = [],
  zona,
  ubicacionUsuario,
  alTocar,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<L.Map | null>(null);
  const capaMarcadores = useRef<L.LayerGroup | null>(null);
  const capaZona = useRef<L.LayerGroup | null>(null);
  const capaUsuario = useRef<L.LayerGroup | null>(null);

  // El manejador de toques se registra una vez; la función actual se lee de
  // aquí para no volver a registrarlo cada vez que llegan props nuevas.
  const alTocarActual = useRef(alTocar);
  alTocarActual.current = alTocar;

  useEffect(() => {
    if (!contenedor.current) return;
    const m = L.map(contenedor.current, {
      center: [region.latitude, region.longitude],
      zoom: zoomPara(region.longitudeDelta),
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer(TESELAS, {
      subdomains: 'abcd',
      minZoom: ZOOM_MINIMO,
      maxZoom: ZOOM_MAXIMO,
    }).addTo(m);
    // Abajo a la izquierda: abajo a la derecha la tapa el botón «Reportar».
    L.control.attribution({ position: 'bottomleft', prefix: false }).addAttribution(ATRIBUCION).addTo(m);

    capaZona.current = L.layerGroup().addTo(m);
    capaUsuario.current = L.layerGroup().addTo(m);
    capaMarcadores.current = L.layerGroup().addTo(m);

    m.on('click', (e: L.LeafletMouseEvent) => {
      alTocarActual.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapa.current = m;
    return () => {
      m.remove();
      mapa.current = null;
    };
    // Se crea una sola vez; los cambios de región los atiende el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Se reencuadra solo si cambió la región pedida. Las props llegan serializadas
  // y cada mensaje trae objetos nuevos: comparar por valor evita devolver el
  // mapa a su sitio mientras alguien lo recorre.
  useEffect(() => {
    mapa.current?.setView([region.latitude, region.longitude], zoomPara(region.longitudeDelta));
  }, [region.latitude, region.longitude, region.longitudeDelta]);

  useEffect(() => {
    const capa = capaMarcadores.current;
    if (!capa) return;
    capa.clearLayers();
    for (const m of marcadores) {
      L.circleMarker([m.lat, m.lng], {
        radius: 9,
        color: '#fff',
        weight: 2,
        fillColor: m.color,
        fillOpacity: 1,
        // Tocar un marcador abre su globo; no cuenta como tocar el mapa.
        bubblingMouseEvents: false,
      })
        .bindPopup(globo(m))
        .addTo(capa);
    }
  }, [marcadores]);

  useEffect(() => {
    const capa = capaZona.current;
    if (!capa) return;
    capa.clearLayers();
    if (zona) {
      L.circle([zona.lat, zona.lng], {
        radius: zona.radioM,
        color: AZUL,
        opacity: 0.8,
        weight: 2,
        fillColor: AZUL,
        fillOpacity: 0.15,
        // Tocar dentro de la zona vuelve a elegir el punto, no la selecciona.
        interactive: false,
      }).addTo(capa);
    }
  }, [zona?.lat, zona?.lng, zona?.radioM]);

  useEffect(() => {
    const capa = capaUsuario.current;
    if (!capa) return;
    capa.clearLayers();
    if (ubicacionUsuario) {
      L.circleMarker([ubicacionUsuario.lat, ubicacionUsuario.lng], {
        radius: 7,
        color: '#fff',
        weight: 3,
        fillColor: AZUL,
        fillOpacity: 1,
        interactive: false,
      }).addTo(capa);
    }
  }, [ubicacionUsuario?.lat, ubicacionUsuario?.lng]);

  return (
    <div
      ref={contenedor}
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: '#EDEAE4' }}
    />
  );
}
