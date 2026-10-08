import { apiClient } from './api';

/**
 * Los tres estados del régimen de faltas.
 *
 *  - NORMAL: sin faltas.
 *  - CON_FALTA: una persona declaró falsa una denuncia de esta cuenta. Durante
 *    los 7 días siguientes no puede registrar, firmar ni prolongar denuncias;
 *    después, la falta solo cuenta para la suspensión.
 *  - SUSPENDIDA: dos personas distintas lo declararon. No puede denunciar, ni
 *    firmar, ni recibir alertas.
 */
export type EstadoSancion = 'NORMAL' | 'CON_FALTA' | 'SUSPENDIDA';

export type FuncionRestringida = 'DENUNCIAR' | 'FIRMAR' | 'PROLONGAR' | 'RECIBIR_ALERTAS';

/**
 * Lo que el servidor cuenta de la situación propia.
 *
 * Las faltas llegan sin la denuncia que las originó ni nada de la persona que
 * cerró la alerta: solo cuándo ocurrieron.
 */
export interface SituacionSanciones {
  estado: EstadoSancion;
  faltas: { tipo: 'CIERRE_CON_SANCION'; creada_en: string }[];
  /** Hasta cuándo dura la suspensión de unos días de la última falta, si sigue. */
  suspendida_hasta: string | null;
  funciones_restringidas: FuncionRestringida[];
}

/** «11 de octubre, 14:30»: lo justo para saber hasta cuándo. */
export const fechaCorta = (iso: string): string =>
  new Date(iso).toLocaleString('es-BO', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

export interface PresentacionSancion {
  titulo: string;
  detalle: string;
  color: string;
  fondo: string;
  icono: string;
}

/**
 * Cómo se le explica a una persona su situación.
 *
 * Las sanciones son automáticas: no hay a quién reclamarle, así que al menos
 * tienen que ser legibles. Cada texto dice qué cambia, no solo el nombre del
 * estado.
 */
export function presentacionDe(situacion: SituacionSanciones): PresentacionSancion {
  switch (situacion.estado) {
    case 'SUSPENDIDA':
      return {
        titulo: 'Cuenta suspendida',
        detalle:
          'Dos personas distintas declararon falsas tus denuncias. No puedes denunciar, firmar ni recibir alertas. Sí puedes cerrar las alertas que te identifiquen.',
        color: '#B32C24',
        fondo: '#FAE5E3',
        icono: 'ban-outline',
      };
    case 'CON_FALTA':
      return {
        titulo:
          situacion.faltas.length === 1 ? 'Tienes una falta' : `Tienes ${situacion.faltas.length} faltas`,
        detalle: situacion.suspendida_hasta
          ? `Una persona declaró falsa una denuncia tuya. Hasta el ${fechaCorta(situacion.suspendida_hasta)} no puedes registrar, firmar ni prolongar denuncias. Sigues recibiendo alertas y puedes reportar avistamientos.`
          : 'Una persona declaró falsa una denuncia tuya. Ya puedes volver a denunciar, pero si otra persona declara falsa otra de tus denuncias, tu cuenta quedará suspendida.',
        color: '#8F5600',
        fondo: '#F9EEDA',
        icono: 'alert-circle-outline',
      };
    default:
      return {
        titulo: 'Sin faltas',
        detalle: 'Puedes denunciar, firmar y recibir alertas sin restricciones.',
        color: '#0E7247',
        fondo: '#E2F2EA',
        icono: 'checkmark-circle-outline',
      };
  }
}

/**
 * Las funciones que la persona reconoce, en el orden en que las usa, con lo que
 * significa cada una. La lista de restringidas la decide el servidor.
 */
export const FUNCIONES: { funcion: FuncionRestringida; etiqueta: string }[] = [
  { funcion: 'DENUNCIAR', etiqueta: 'Registrar denuncias' },
  { funcion: 'FIRMAR', etiqueta: 'Firmar declaraciones juradas' },
  { funcion: 'PROLONGAR', etiqueta: 'Prolongar alertas' },
  { funcion: 'RECIBIR_ALERTAS', etiqueta: 'Recibir alertas de tu zona' },
];

class SancionesService {
  async miSituacion(): Promise<SituacionSanciones> {
    const response = await apiClient.get<SituacionSanciones>('/usuarios/me/sanciones');
    return response.data;
  }
}

export const sancionesService = new SancionesService();
export default sancionesService;
