import { Denuncia } from './entities/denuncia.entity';
import { EstadoDenuncia } from './domain/estados';
import {
  aFechaLocal,
  edadEn,
  esMenorDeEdad,
  MOTIVO_SIN_FOTOGRAFIA,
} from './domain/minoria-edad';
import {
  ETIQUETA_CALZADO,
  ETIQUETA_CIRCUNSTANCIA,
  ETIQUETA_COLOR_CABELLO,
  ETIQUETA_COLOR_OJOS,
  ETIQUETA_COLOR_PIEL,
  ETIQUETA_COLOR_PRENDA,
  ETIQUETA_CONDICION,
  ETIQUETA_CONTEXTURA,
  ETIQUETA_ESTATURA,
  ETIQUETA_PRENDA_INFERIOR,
  ETIQUETA_PRENDA_SUPERIOR,
  ETIQUETA_SENA,
  ETIQUETA_SEXO,
} from './etiquetas';

/**
 * La ficha pública de una alerta: la página que abre el enlace del reporte de
 * avistamiento.
 *
 * La Policía que recibe el reporte no tiene la aplicación ni una cuenta, y el
 * texto del mensaje no trae la foto. La ficha le muestra a quién buscar.
 *
 * Es una página y no una imagen adjunta porque la sirve el sistema en cada
 * visita, y así obedece las reglas de la alerta: si la persona reportada la
 * retira, o quien la presentó informa que apareció, el enlace deja de mostrar
 * nada. Una imagen compartida seguiría circulando con la foto después de un
 * «Estoy bien».
 *
 * Lo que no lleva, a propósito:
 *  - nada de quien presentó la denuncia (I8);
 *  - nada del avistamiento: el enlace es el mismo para toda la alerta, así que
 *    abrirlo no le dice al servidor que alguien vio a la persona (I2);
 *  - la foto de un menor, que tampoco existe en la base;
 *  - ningún script, para poder servirla con una política que los prohíbe.
 *
 * Todo es función pura: el controlador busca los datos y esto arma el texto.
 */

/** Los campos de la denuncia que la ficha muestra. Nada más llega hasta aquí. */
export type DenunciaDeFicha = Pick<
  Denuncia,
  | 'nombre_persona_buscada'
  | 'estado'
  | 'expira_en'
  | 'fecha_nacimiento'
  | 'sexo'
  | 'estatura_rango'
  | 'contextura'
  | 'color_piel'
  | 'color_cabello'
  | 'color_ojos'
  | 'senas_particulares'
  | 'prenda_superior'
  | 'color_prenda_superior'
  | 'prenda_inferior'
  | 'color_prenda_inferior'
  | 'calzado'
  | 'condicion_relevante'
  | 'circunstancia'
  | 'ultimo_avistamiento_en'
  | 'latitude'
  | 'longitude'
>;

export interface ContextoDeFicha {
  /** Dirección absoluta de la foto, o nulo si no hay una que mostrar. */
  urlFoto: string | null;
  /** Si la foto se ocultó tras un reporte: se dice, en vez de «Sin fotografía». */
  contenidoOculto?: boolean;
  ahora: Date;
}

/** Los tipos de imagen que la ficha sirve. Cualquier otra cosa cuenta como «sin foto». */
export type TipoDeImagen = 'image/jpeg' | 'image/png' | 'image/webp';

const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * El tipo de una imagen por sus primeros bytes.
 *
 * La base guarda la foto en base64, sin su tipo. Mirar la firma del archivo en
 * vez de suponer JPEG evita servir como imagen algo que no lo es —los datos de
 * demostración guardan un texto cualquiera— y que el navegador lo adivine.
 */
export const tipoDeImagen = (bytes: Buffer): TipoDeImagen | null => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(FIRMA_PNG)) return 'image/png';
  if (
    bytes.length >= 12 &&
    bytes.toString('latin1', 0, 4) === 'RIFF' &&
    bytes.toString('latin1', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
};

/** Lo que se muestra en lugar de una foto que se ocultó tras un reporte. */
export const FOTOGRAFIA_OCULTA = 'La fotografía se ocultó tras un reporte de contenido.';

/** El nombre de la persona buscada es texto libre: todo se escapa antes de entrar al HTML. */
export const escaparHtml = (texto: string): string =>
  texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Fecha y hora en la de Bolivia, no en la del servidor, y en 24 horas como el
 * reporte de avistamiento: «14:20», no «2:20 p. m.».
 */
const fechaYHora = (fecha: Date): string =>
  new Intl.DateTimeFormat('es-BO', {
    timeZone: 'America/La_Paz',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(fecha);

const etiquetaDe = <T extends string>(mapa: Record<T, string>, valor: T | null): string | null =>
  valor ? (mapa[valor] ?? valor) : null;

/** «Chompa azul y pantalón jean negro», igual que en la aplicación. */
const vestimenta = (d: DenunciaDeFicha): string | null => {
  const pieza = (prenda: string | null, color: string | null) =>
    prenda ? [prenda, color?.toLowerCase()].filter(Boolean).join(' ') : null;
  const piezas = [
    pieza(
      etiquetaDe(ETIQUETA_PRENDA_SUPERIOR, d.prenda_superior),
      etiquetaDe(ETIQUETA_COLOR_PRENDA, d.color_prenda_superior),
    ),
    pieza(
      etiquetaDe(ETIQUETA_PRENDA_INFERIOR, d.prenda_inferior),
      etiquetaDe(ETIQUETA_COLOR_PRENDA, d.color_prenda_inferior),
    ),
  ].filter((p): p is string => p !== null);
  if (piezas.length === 0) return null;
  // La segunda prenda va en minúscula: es la mitad de una misma frase.
  const [primera, ...resto] = piezas;
  return [primera, ...resto.map((p) => p.charAt(0).toLowerCase() + p.slice(1))].join(' y ');
};

const edadDe = (d: DenunciaDeFicha, ahora: Date): number | null => {
  if (!d.fecha_nacimiento) return null;
  const nacimiento = aFechaLocal(d.fecha_nacimiento);
  return Number.isNaN(nacimiento.getTime()) ? null : edadEn(nacimiento, ahora);
};

/** Vencida aunque el planificador todavía no la haya marcado: manda el plazo. */
const estaVencida = (d: DenunciaDeFicha, ahora: Date): boolean =>
  d.estado === EstadoDenuncia.CADUCADA ||
  (d.expira_en !== null && d.expira_en.getTime() <= ahora.getTime());

/** Una línea que describe a la persona, para la vista previa del enlace. */
const resumen = (d: DenunciaDeFicha, ahora: Date): string => {
  const edad = edadDe(d, ahora);
  const partes = [
    etiquetaDe(ETIQUETA_SEXO, d.sexo),
    edad !== null ? `${edad} años` : null,
    etiquetaDe(ETIQUETA_ESTATURA, d.estatura_rango)?.toLowerCase() ?? null,
  ].filter(Boolean);
  const visto = d.ultimo_avistamiento_en
    ? `Vista por última vez el ${fechaYHora(d.ultimo_avistamiento_en)}.`
    : '';
  return [partes.length > 0 ? `${partes.join(', ')}.` : '', visto].filter(Boolean).join(' ');
};

/** Pares etiqueta/valor, en el orden en que sirven para reconocer a alguien. */
const filas = (d: DenunciaDeFicha, ahora: Date): Array<[string, string]> => {
  const edad = edadDe(d, ahora);
  const lista: Array<[string, string | null]> = [
    ['Edad', edad !== null ? `${edad} años` : null],
    ['Sexo', etiquetaDe(ETIQUETA_SEXO, d.sexo)],
    ['Estatura', etiquetaDe(ETIQUETA_ESTATURA, d.estatura_rango)],
    ['Contextura', etiquetaDe(ETIQUETA_CONTEXTURA, d.contextura)],
    ['Color de piel', etiquetaDe(ETIQUETA_COLOR_PIEL, d.color_piel)],
    ['Cabello', etiquetaDe(ETIQUETA_COLOR_CABELLO, d.color_cabello)],
    ['Ojos', etiquetaDe(ETIQUETA_COLOR_OJOS, d.color_ojos)],
    [
      'Señas particulares',
      (d.senas_particulares ?? []).map((s) => ETIQUETA_SENA[s] ?? s).join(', ') || null,
    ],
    ['Vestimenta', vestimenta(d)],
    ['Calzado', etiquetaDe(ETIQUETA_CALZADO, d.calzado)],
    [
      'A tener en cuenta',
      (d.condicion_relevante ?? []).map((c) => ETIQUETA_CONDICION[c] ?? c).join(', ') || null,
    ],
    ['Circunstancia', etiquetaDe(ETIQUETA_CIRCUNSTANCIA, d.circunstancia)],
    [
      'Vista por última vez',
      d.ultimo_avistamiento_en ? fechaYHora(d.ultimo_avistamiento_en) : null,
    ],
  ];
  return lista.filter((fila): fila is [string, string] => fila[1] !== null);
};

/**
 * El mapa apunta al centro de la celda de ~1 km que guarda la base, nunca a un
 * punto exacto: ese punto no existe en el sistema.
 */
const enlaceDeZona = (d: DenunciaDeFicha): string =>
  `https://maps.google.com/?q=${d.latitude.toFixed(5)},${d.longitude.toFixed(5)}`;

const ESTILOS = `
  :root { --fondo: #f3f4f6; --hoja: #ffffff; --texto: #16181d; --suave: #5b6270;
          --linea: #e3e5ea; --acento: #b32c24; --aviso-fondo: #fbeceb; --aviso: #8c231d;
          --gris-fondo: #eceef2; --gris: #4a505c; }
  @media (prefers-color-scheme: dark) {
    :root { --fondo: #111317; --hoja: #1b1e24; --texto: #eef0f4; --suave: #a3a9b6;
            --linea: #2c3039; --acento: #ff7b70; --aviso-fondo: #3a1d1b; --aviso: #ffb4ad;
            --gris-fondo: #262a32; --gris: #c3c8d2; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fondo); color: var(--texto);
         font: 16px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 560px; margin: 0 auto; padding: 16px; }
  .hoja { background: var(--hoja); border-radius: 16px; padding: 20px; }
  .rotulo { margin: 0; color: var(--acento); font-size: 13px; font-weight: 700;
            letter-spacing: 0.08em; text-transform: uppercase; }
  h1 { margin: 4px 0 12px; font-size: 28px; line-height: 1.2; text-wrap: balance; }
  .estado { display: inline-block; margin: 0 0 16px; padding: 4px 10px; border-radius: 999px;
            font-size: 14px; font-weight: 600; background: var(--aviso-fondo); color: var(--aviso); }
  .estado.vencida { background: var(--gris-fondo); color: var(--gris); }
  img { display: block; width: 100%; max-height: 440px; object-fit: cover; border-radius: 12px; }
  .sin-foto { margin: 0; padding: 16px; border-radius: 12px; background: var(--gris-fondo);
              color: var(--gris); font-size: 14px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 10px 16px; margin: 20px 0 0; }
  dt { color: var(--suave); font-size: 14px; }
  dd { margin: 0; font-weight: 600; }
  @media (max-width: 480px) {
    dl { grid-template-columns: 1fr; gap: 0; }
    dt { margin-top: 12px; }
  }
  a { color: var(--acento); }
  footer { margin: 16px 4px 0; color: var(--suave); font-size: 13px; }
  footer p { margin: 0 0 8px; }
`;

const pagina = (titulo: string, cabeza: string, cuerpo: string): string =>
  `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escaparHtml(titulo)}</title>
${cabeza}<style>${ESTILOS}</style>
</head>
<body>
<main>
${cuerpo}
</main>
</body>
</html>
`;

/** La ficha de una alerta que se puede mostrar. */
export const htmlDeFicha = (d: DenunciaDeFicha, contexto: ContextoDeFicha): string => {
  const { urlFoto, ahora } = contexto;
  const nombre = d.nombre_persona_buscada?.trim() || null;
  const titulo = nombre ? `Se busca a ${nombre}` : 'Persona desaparecida';
  const descripcion = resumen(d, ahora);
  const vencida = estaVencida(d, ahora);

  const cabeza = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escaparHtml(titulo)}">`,
    descripcion
      ? `<meta property="og:description" content="${escaparHtml(descripcion)}">`
      : '',
    urlFoto ? `<meta property="og:image" content="${escaparHtml(urlFoto)}">` : '',
  ]
    .filter(Boolean)
    .map((linea) => `${linea}\n`)
    .join('');

  const foto = urlFoto
    ? `<img src="${escaparHtml(urlFoto)}" alt="${escaparHtml(nombre ? `Fotografía de ${nombre}` : 'Fotografía de la persona buscada')}">`
    : `<p class="sin-foto">${escaparHtml(
        esMenorDeEdad(d.fecha_nacimiento, ahora)
          ? MOTIVO_SIN_FOTOGRAFIA
          : contexto.contenidoOculto
            ? FOTOGRAFIA_OCULTA
            : 'Sin fotografía.',
      )}</p>`;

  const datos = filas(d, ahora)
    .map(([etiqueta, valor]) => `<dt>${escaparHtml(etiqueta)}</dt><dd>${escaparHtml(valor)}</dd>`)
    .join('\n');

  const cuerpo = `<article class="hoja">
<p class="rotulo">Persona desaparecida</p>
<h1>${escaparHtml(nombre ?? 'Nombre no registrado')}</h1>
<p class="estado${vencida ? ' vencida' : ''}">${
    vencida
      ? 'La alerta ya no se difunde, pero nadie informó que la persona apareció.'
      : 'Alerta activa: se busca a esta persona.'
  }</p>
${foto}
<dl>
${datos}
<dt>Zona del último avistamiento</dt><dd><a href="${escaparHtml(enlaceDeZona(d))}">Ver en el mapa</a> (aproximada, ~1 km)</dd>
</dl>
</article>
<footer>
<p>Si tienes información, avisa a la Policía.</p>
<p>Ficha de una alerta de la aplicación de alerta temprana. No incluye datos de quien presentó la denuncia. Deja de mostrarse si la persona reportada retira la alerta o si se informa que apareció.</p>
</footer>`;

  return pagina(titulo, cabeza, cuerpo);
};

/**
 * Lo que ve quien abre el enlace de una alerta que no se puede mostrar.
 *
 * Es la misma página para una retirada, una cerrada, una sin firmar, una que no
 * existe y un enlace mal copiado: distinguirlas dejaría sondear qué enlaces
 * esconden una denuncia.
 */
export const htmlFichaNoDisponible = (): string =>
  pagina(
    'Ficha no disponible',
    '',
    `<article class="hoja">
<p class="rotulo">Ficha no disponible</p>
<h1>Esta ficha ya no se muestra</h1>
<p>Puede que la alerta se haya retirado, que se haya informado que la persona apareció o que el enlace esté incompleto.</p>
</article>`,
  );
