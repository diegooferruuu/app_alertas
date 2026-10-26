/**
 * El reporte de avistamiento, armado entero en el teléfono.
 *
 * Nada de esto pasa por el servidor (I2): ni el lugar, ni la hora, ni quién
 * vio a la persona. El texto lo entrega la propia persona a la autoridad, por
 * llamada o por WhatsApp. Son funciones puras para poder probarlas sin pantalla:
 * un error aquí confunde a la Policía, no a la aplicación.
 */

/** Cuándo se vio a la persona. Franjas cerradas: no hay texto libre (I3). */
export type FranjaAvistamiento = 'MENOS_DE_30_MIN' | 'DE_30_MIN_A_1_H' | 'DE_1_A_3_H' | 'MAS_DE_3_H';

/**
 * Las franjas, con los minutos hacia atrás que abarca cada una. La última no
 * tiene límite: «hace más de 3 h» puede ser ayer.
 */
export const FRANJAS: {
  valor: FranjaAvistamiento;
  etiqueta: string;
  desdeMin: number;
  hastaMin: number | null;
}[] = [
  { valor: 'MENOS_DE_30_MIN', etiqueta: 'Hace menos de 30 min', desdeMin: 0, hastaMin: 30 },
  { valor: 'DE_30_MIN_A_1_H', etiqueta: 'Entre 30 min y 1 h', desdeMin: 30, hastaMin: 60 },
  { valor: 'DE_1_A_3_H', etiqueta: 'Entre 1 y 3 h', desdeMin: 60, hastaMin: 180 },
  { valor: 'MAS_DE_3_H', etiqueta: 'Hace más de 3 h', desdeMin: 180, hastaMin: null },
];

const dosCifras = (n: number) => String(n).padStart(2, '0');
const hora = (d: Date) => `${dosCifras(d.getHours())}:${dosCifras(d.getMinutes())}`;
const fecha = (d: Date) =>
  `${dosCifras(d.getDate())}/${dosCifras(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * La franja convertida a horas reales del reloj.
 *
 * Quien atiende la llamada necesita «entre las 14:10 y las 14:40», no «hace un
 * rato»: la franja relativa deja de servir en cuanto pasa el tiempo. Lleva la
 * fecha, y las dos si el rango cruza la medianoche.
 */
export function momentoDe(franja: FranjaAvistamiento, ahora: Date): string {
  const f = FRANJAS.find((x) => x.valor === franja);
  if (!f) throw new Error(`Franja desconocida: ${franja}`);

  const hasta = new Date(ahora.getTime() - f.desdeMin * 60_000);
  if (f.hastaMin === null) {
    return `antes de las ${hora(hasta)} del ${fecha(hasta)}`;
  }
  const desde = new Date(ahora.getTime() - f.hastaMin * 60_000);
  return fecha(desde) === fecha(hasta)
    ? `entre las ${hora(desde)} y las ${hora(hasta)} del ${fecha(hasta)}`
    : `entre las ${hora(desde)} del ${fecha(desde)} y las ${hora(hasta)} del ${fecha(hasta)}`;
}

/** Un enlace que cualquier teléfono abre en su mapa. No necesita clave. */
export const enlaceDeMapa = (lat: number, lng: number): string =>
  `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;

/** Quién manda el reporte. */
export interface QuienReporta {
  nombre: string;
  /** Si la cuenta registró su documento. */
  conDocumento: boolean;
}

/**
 * Quién manda el reporte, a partir de su cuenta.
 *
 * Va siempre: es quien avisa, y la llamada o el WhatsApp ya le muestran su
 * número a la autoridad. El nombre es el de la cuenta en los dos casos. Con
 * documento registrado es además el que se contrastó contra el carnet
 * —registrarlo lo copia tal cual y la cuenta no deja cambiarlo—; sin documento,
 * es el que la persona escribió al crear la cuenta. El reporte dice cuál de los
 * dos es, para que la autoridad sepa cuánto pesa.
 */
export const quienReporta = (cuenta: {
  full_name: string;
  documento_registrado: boolean;
}): QuienReporta => ({
  nombre: cuenta.full_name.trim(),
  conDocumento: cuenta.documento_registrado,
});

/**
 * El enlace a la ficha pública de la alerta: foto, nombre y descripción, para
 * que la autoridad reconozca a la persona sin tener la aplicación.
 *
 * Es el mismo para toda la alerta, no uno por reporte: abrirlo no le dice al
 * servidor que alguien vio a la persona (I2). Y la ficha la sirve el sistema en
 * cada visita, así que deja de mostrarse si la alerta se retira.
 */
export const enlaceDeFicha = (urlDeLaApi: string, denunciaId: string): string =>
  `${urlDeLaApi.replace(/\/+$/, '')}/fichas/${denunciaId}`;

export interface DatosDelReporte {
  nombre: string | null;
  punto: { lat: number; lng: number };
  /** La calle más cercana, si el teléfono la pudo averiguar. */
  calle: string | null;
  franja: FranjaAvistamiento;
  ahora: Date;
  /** Nulo solo si la sesión no cargó su cuenta: el reporte sale igual, sin esa línea. */
  reporta: QuienReporta | null;
  ficha: string | null;
}

/**
 * El texto que se lee en la llamada o se manda por WhatsApp.
 *
 * Sin el CI de la persona buscada: el sistema solo guarda su hash, así que
 * quien recibe la alerta no lo tiene. Tampoco el número de caso de la FELCC,
 * que no es público: la Policía lo da a quien denuncia y no aparece en sus
 * propias pancartas. Con el nombre, la zona y el momento, la autoridad busca
 * el caso como con cualquier aviso ciudadano.
 *
 * Nada de quien presentó la denuncia: ni su nombre ni un contacto (I8, P4). La
 * autoridad llega a la familia por sus propios canales.
 */
export function armarReporte(d: DatosDelReporte): string {
  const mapa = enlaceDeMapa(d.punto.lat, d.punto.lng);
  return [
    'Reporte de avistamiento — persona reportada como desaparecida',
    `Persona buscada: ${d.nombre?.trim() || 'sin nombre registrado'}`,
    `Zona: ${d.calle?.trim() ? `${d.calle.trim()} — ${mapa}` : mapa}`,
    `Momento: ${momentoDe(d.franja, d.ahora)}`,
    ...(d.reporta
      ? [
          `Reporta: ${d.reporta.nombre} (${
            d.reporta.conDocumento ? 'con documento registrado' : 'sin documento registrado'
          })`,
        ]
      : []),
    ...(d.ficha ? [`Ficha de la persona: ${d.ficha}`] : []),
  ].join('\n');
}

/** Lo que marca el botón «Llamar». Sin espacios ni guiones, que el marcador no quiere. */
export const enlaceDeLlamada = (numero: string): string => `tel:${numero.replace(/[^\d+]/g, '')}`;

/** Abre WhatsApp con el reporte ya escrito. `wa.me` quiere el número solo en dígitos. */
export const enlaceDeWhatsApp = (numero: string, texto: string): string =>
  `https://wa.me/${numero.replace(/\D/g, '')}?text=${encodeURIComponent(texto)}`;
