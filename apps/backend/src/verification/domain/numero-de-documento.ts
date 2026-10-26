import { normalizarComplemento } from '../../users/domain/documento-identidad';

/** Lo que el carnet dice del número que declaró la persona. */
export interface LecturaDelNumero {
  /** Si el número aparece como cifra entera, no como trozo de otra. */
  aparece: boolean;
  /** El complemento impreso junto al número, si se pudo leer. */
  complemento: string | null;
}

/**
 * Busca el número declarado en el texto del carnet y lee el complemento que lo
 * acompaña.
 *
 * Antes se juntaban todos los dígitos del carnet y bastaba con que el número
 * apareciera en algún lugar de esa tira. Eso tenía dos agujeros: pasaba un
 * número que solo era un trozo de otro —o de las fechas, pegadas a la serie— y
 * se ignoraba el complemento, así que quien tiene `12345678-1K` podía
 * registrarse como `12345678`, que es otra persona.
 *
 * Ahora el número tiene que aparecer como cifra entera. Se tolera un espacio
 * entre dígitos, que el OCR mete a veces. Y el complemento solo se reconoce
 * pegado al número con un guion, que es como se imprime: sin guion no se
 * adivina, porque las letras del lugar de expedición de los carnets viejos
 * («1234567 LP») o una fecha en la misma línea se confundirían con él.
 */
export function leerNumeroDelCarnet(texto: string, numero: string): LecturaDelNumero {
  const cifra = numero.split('').join(' ?');
  const patron = new RegExp(`(?<![0-9])${cifra}(?![0-9])`, 'g');
  const mayusculas = texto.toUpperCase();

  let aparece = false;
  for (const coincidencia of mayusculas.matchAll(patron)) {
    aparece = true;
    const resto = mayusculas.slice((coincidencia.index ?? 0) + coincidencia[0].length);
    const complemento = /^\s*[-–—]\s*([0-9A-Z]{1,2})(?![0-9A-Z])/.exec(resto);
    if (complemento) return { aparece, complemento: complemento[1] };
  }
  return { aparece, complemento: null };
}

/**
 * Lo que el OCR suele confundir en un complemento: la I y la L por un 1, la O
 * por un 0. Solo para comparar lo leído con lo declarado; lo que se guarda es lo
 * que escribió la persona.
 */
const plegar = (complemento: string): string =>
  complemento.replace(/[IL]/g, '1').replace(/O/g, '0');

export type ResultadoDelNumero = { coincide: true } | { coincide: false; motivo: string };

/**
 * Compara el número y el complemento declarados con lo que muestra el carnet.
 *
 * Tienen que coincidir los dos, también cuando no hay complemento: si el carnet
 * lo muestra y la persona no lo escribió, se rechaza. Es lo que impide
 * registrarse con el número solo, que identifica a otra persona.
 *
 * El motivo se le muestra a quien está registrando su propio carnet, así que
 * puede decir qué se leyó: no revela nada de nadie más.
 */
export function compararNumeroDelCarnet(
  texto: string,
  numero: string,
  complementoDeclarado?: string | null,
): ResultadoDelNumero {
  const lectura = leerNumeroDelCarnet(texto, numero);
  if (!lectura.aparece) {
    return { coincide: false, motivo: `el número ${numero} no aparece en el documento` };
  }

  const declarado = normalizarComplemento(complementoDeclarado);
  const leido = lectura.complemento;

  if (leido && !declarado) {
    return {
      coincide: false,
      motivo: `tu carnet muestra el complemento ${leido} junto al número y no lo escribiste en el campo «Complemento»`,
    };
  }
  if (!leido && declarado) {
    return {
      coincide: false,
      motivo: `no se ve el complemento ${declarado} junto al número. Si tu carnet no tiene complemento, deja ese campo vacío; si lo tiene, toma una foto más nítida`,
    };
  }
  if (leido && declarado && plegar(leido) !== plegar(declarado)) {
    return {
      coincide: false,
      motivo: `el complemento de tu carnet parece ser ${leido}, no ${declarado}`,
    };
  }
  return { coincide: true };
}
