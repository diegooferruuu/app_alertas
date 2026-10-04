'use dom';

/**
 * Mapa Leaflet. Es un componente DOM de Expo: este archivo no corre en el motor
 * de React Native sino dentro de una webview, como una página. Lo que llega por
 * props viaja serializado, y `alTocar` es una función del lado nativo que se
 * invoca desde aquí.
 *
 * Solo lo usa Android, y solo cuando el APK no trae clave de Google Maps; el
 * porqué está en `Mapa.android.tsx`.
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
 * Teselas de OpenStreetMap.
 *
 * Hasta el 2026-10-04 eran de CARTO, sin clave. Ahora CARTO la exige: en vez de
 * calles devuelve una imagen que dice «API KEY REQUIRED», y eso es lo que se veía
 * en el teléfono. OpenStreetMap atiende a una página que se identifica: si la
 * petición trae la cabecera Referer entrega el mapa, y si no, una imagen de
 * «Access blocked» (las dos cosas comprobadas con curl ese día). En desarrollo
 * esta página la sirve Metro por HTTP, y la webview manda Referer. Fuera de
 * Metro no hay esa garantía; ahí corresponde Google, con clave.
 *
 * Sus servidores los pagan voluntarios: esto es un respaldo para pruebas, no la
 * forma de distribuir la aplicación.
 */
const TESELAS = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

/**
 * Sin enlaces a propósito: tocar un enlace navegaría la webview fuera del mapa.
 * La atribución la exige la licencia de los datos (ODbL).
 */
const ATRIBUCION = '© OpenStreetMap';

/** Por debajo de 3 no hay nada útil, y OpenStreetMap no sirve más allá de 19. */
const ZOOM_MINIMO = 3;
const ZOOM_MAXIMO = 19;

const AZUL = '#007AFF';
const FONDO = '#EDEAE4';

/** Errores de teselas seguidos, sin ninguna cargada, para dar las calles por perdidas. */
const TESELAS_FALLIDAS_PARA_AVISAR = 4;

/**
 * Lo que falle aquí no puede dejar la página en blanco, sin explicación: eso
 * pasó en Android y no había forma de saber por qué. Se escribe en la propia
 * pantalla del mapa.
 *
 * Va a nivel de módulo, no dentro de React, porque el arranque del componente
 * DOM corre después de que este archivo se evalúa: si ese arranque lanza, este
 * oyente ya está puesto y lo muestra.
 */
const avisoEnPagina = (texto: string, tono: 'error' | 'aviso' = 'error') => {
  let caja = document.getElementById('aviso-mapa');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'aviso-mapa';
    document.body.appendChild(caja);
  }
  Object.assign(caja.style, {
    position: 'fixed',
    left: '12px',
    right: '12px',
    top: '12px',
    padding: '10px 12px',
    borderRadius: '8px',
    zIndex: '9999',
    font: '13px/1.4 system-ui, sans-serif',
    whiteSpace: 'pre-wrap',
    background: tono === 'error' ? '#FAE5E3' : '#F9EEDA',
    color: tono === 'error' ? '#B32C24' : '#6B4300',
  });
  caja.textContent = texto;
};

if (typeof window !== 'undefined') {
  // Con fondo propio, una página que corrió ya no se confunde con una que no
  // cargó: si se ve blanco, el código de aquí ni siquiera llegó a ejecutarse.
  const base = document.createElement('style');
  base.textContent = `html, body { margin: 0; height: 100%; background: ${FONDO}; }`;
  document.head.appendChild(base);

  window.addEventListener('error', (evento) => {
    avisoEnPagina(`El mapa falló: ${evento.message || String(evento.error)}`);
  });
  window.addEventListener('unhandledrejection', (evento) => {
    avisoEnPagina(`El mapa falló: ${String((evento as PromiseRejectionEvent).reason)}`);
  });
}

interface Props {
  region: RegionMapa;
  marcadores?: MarcadorMapa[];
  zona?: ZonaMapa | null;
  ubicacionUsuario?: PuntoMapa | null;
  alTocar?: (punto: PuntoMapa) => void;
  /** Avisa al lado nativo que el mapa se creó: la página corre. */
  alListo?: () => void;
  /** Avisa al lado nativo por qué no se pudo crear el mapa. */
  alFallar?: (motivo: string) => void;
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
  alListo,
  alFallar,
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
    let m: L.Map;
    try {
      m = L.map(contenedor.current, {
        center: [region.latitude, region.longitude],
        zoom: zoomPara(region.longitudeDelta),
        zoomControl: false,
        attributionControl: false,
      });
    } catch (error) {
      const motivo = error instanceof Error ? error.message : String(error);
      avisoEnPagina(`No se pudo crear el mapa: ${motivo}`);
      alFallar?.(motivo);
      return;
    }

    const teselas = L.tileLayer(TESELAS, {
      minZoom: ZOOM_MINIMO,
      maxZoom: ZOOM_MAXIMO,
    }).addTo(m);
    // Sin calles el mapa sigue sirviendo —los puntos se dibujan igual—, pero
    // hay que decirlo: si no, parece un mapa vacío.
    let cargadas = 0;
    let fallidas = 0;
    teselas.on('tileload', () => {
      cargadas++;
    });
    teselas.on('tileerror', () => {
      fallidas++;
      if (cargadas === 0 && fallidas === TESELAS_FALLIDAS_PARA_AVISAR) {
        avisoEnPagina(
          'No cargan las calles: el teléfono no llega al servidor de mapas (OpenStreetMap). Revisa la conexión a internet.',
          'aviso',
        );
      }
    });
    // Abajo a la izquierda: abajo a la derecha la tapa el botón «Reportar».
    L.control.attribution({ position: 'bottomleft', prefix: false }).addAttribution(ATRIBUCION).addTo(m);

    capaZona.current = L.layerGroup().addTo(m);
    capaUsuario.current = L.layerGroup().addTo(m);
    capaMarcadores.current = L.layerGroup().addTo(m);

    m.on('click', (e: L.LeafletMouseEvent) => {
      alTocarActual.current?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    mapa.current = m;
    // Si la webview todavía no tenía su tamaño al crear el mapa, Leaflet lo
    // habría medido en cero y no pediría teselas: se vuelve a medir enseguida.
    setTimeout(() => m.invalidateSize(), 0);
    alListo?.();
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
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, left: 0, background: FONDO }}
    />
  );
}
