import { Denuncia } from '../entities/denuncia.entity';
import { ContenidoDenuncia } from '../../declaraciones/domain/cadena';

/**
 * Convierte una denuncia en la forma exacta de texto con la que se sella.
 *
 * Existe una sola función para esto y la usan los dos lados: el que firma la
 * declaración jurada y el que emite la constancia. Si cada uno representara los
 * datos a su manera —una fecha con hora y otra sin, un arreglo en distinto
 * orden— el hash sellado y el recalculado diferirían, y la constancia acusaría
 * de alteración una denuncia intacta.
 *
 * Lo que devuelve es también, literalmente, lo que la constancia publica en su
 * campo `denuncia`: quien verifica une esos valores y obtiene el mismo hash sin
 * tener que interpretar nada.
 */

/** Un valor múltiple se une por coma; llega ya ordenado y sin repetidos. */
const unirMultiple = (valores: readonly string[] | null): string =>
  valores && valores.length > 0 ? [...valores].sort().join(',') : '';

/**
 * Fecha sin hora, en ISO.
 *
 * La columna es `date` y TypeORM la devuelve como cadena, pero una escritura
 * reciente en la misma transacción puede dejar un `Date`. Se normalizan los dos
 * casos: de esto depende que el sello no cambie según de dónde venga la fila.
 */
const comoFecha = (valor: Date | string | null): string => {
  if (!valor) return '';
  if (valor instanceof Date) return valor.toISOString().slice(0, 10);
  return valor.slice(0, 10);
};

const comoInstante = (valor: Date | string | null): string => {
  if (!valor) return '';
  return valor instanceof Date ? valor.toISOString() : new Date(valor).toISOString();
};

/**
 * Precisión fija para las coordenadas: el mismo punto debe producir siempre el
 * mismo hash, y la representación decimal de un flotante puede variar.
 */
const comoCoordenada = (valor: number): string => Number(valor).toFixed(7);

export const contenidoSellable = (denuncia: Denuncia): ContenidoDenuncia => ({
  nombre_persona_buscada: denuncia.nombre_persona_buscada ?? '',
  ci_hash_persona_buscada: denuncia.ci_hash_persona_buscada,
  // Solo aparece en las denuncias selladas con la fórmula 1; en las nuevas es
  // nulo y la fórmula 2 ni siquiera lo mira.
  description: denuncia.description ?? '',
  fecha_nacimiento: comoFecha(denuncia.fecha_nacimiento),
  sexo: denuncia.sexo ?? '',
  estatura_rango: denuncia.estatura_rango ?? '',
  contextura: denuncia.contextura ?? '',
  color_piel: denuncia.color_piel ?? '',
  color_cabello: denuncia.color_cabello ?? '',
  color_ojos: denuncia.color_ojos ?? '',
  senas_particulares: unirMultiple(denuncia.senas_particulares),
  ultimo_avistamiento_en: comoInstante(denuncia.ultimo_avistamiento_en),
  prenda_superior: denuncia.prenda_superior ?? '',
  color_prenda_superior: denuncia.color_prenda_superior ?? '',
  prenda_inferior: denuncia.prenda_inferior ?? '',
  color_prenda_inferior: denuncia.color_prenda_inferior ?? '',
  calzado: denuncia.calzado ?? '',
  circunstancia: denuncia.circunstancia ?? '',
  condicion_relevante: unirMultiple(denuncia.condicion_relevante),
  latitude: comoCoordenada(denuncia.latitude),
  longitude: comoCoordenada(denuncia.longitude),
});
