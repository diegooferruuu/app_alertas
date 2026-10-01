import { apiClient } from './api';
import { EstadoDenuncia, NivelConfianza } from './denuncia.service';

/**
 * Una denuncia que identifica a quien está usando la aplicación.
 *
 * Nótese lo que **no** trae: nada del denunciante. Ni su nombre, ni su
 * identificador, ni su documento. El servidor no lo envía (invariante I8) y esta
 * pantalla no tiene por qué mostrarlo: quien acaba de enterarse de que lo
 * reportaron casi siempre solo quiere que la alerta se detenga, no entrar en
 * confrontación. Esa identidad existe, está sellada, y se entrega por la vía
 * deliberada de la constancia.
 */
export interface DenunciaQueMeIdentifica {
  id: string;
  nombre_persona_buscada: string | null;
  description: string;
  nivel_confianza: NivelConfianza;
  estado: EstadoDenuncia;
  /** Si ahora mismo se está alertando a la zona. Una caducada aparece en false. */
  se_esta_difundiendo: boolean;
  /**
   * Si todavía admite el cierre.
   *
   * Las ya cerradas siguen apareciendo en la lista —la constancia probatoria
   * está disponible de forma indefinida y este es el camino hacia ella— pero no
   * se pueden volver a cerrar: INVALIDADA es terminal.
   */
  puede_cerrarse: boolean;
  created_at: string;
}

/**
 * Las dos formas de cerrar una alerta sobre uno mismo.
 *
 *  - SIN_SANCION, «Estoy bien»: nadie recibe una falta.
 *  - CON_SANCION, «Esta denuncia es falsa»: quien la presentó recibe una falta y
 *    ya no puede volver a denunciar a esta persona.
 */
export type TipoCierre = 'SIN_SANCION' | 'CON_SANCION';

export interface ResultadoCierre {
  cerrada: true;
  denuncia_id: string;
  tipo: TipoCierre;
  mensaje: string;
  /** Falso si nadie llegó a firmarla: sin declaración jurada no hay constancia. */
  constancia_disponible: boolean;
}

export interface DatosDeCierre {
  tipo: TipoCierre;
  /**
   * Solo con «Estoy bien», y obligatorio en ese caso: si quien denunció podrá
   * volver a hacerlo. «Es falsa» bloquea siempre y el servidor no lo pregunta.
   */
  bloquear_nueva_denuncia?: boolean;
}

class CierreService {
  /**
   * Las denuncias que identifican a la persona autenticada.
   *
   * No recibe a quién consultar: el servidor lo deduce del documento de la
   * sesión. No hay forma de preguntar por otro.
   */
  async misAlertas(): Promise<DenunciaQueMeIdentifica[]> {
    const response = await apiClient.get<DenunciaQueMeIdentifica[]>('/cierres/denuncias');
    return response.data;
  }

  /** Cierra una alerta que identifica a quien la ejecuta. No se puede deshacer. */
  async cerrar(denunciaId: string, datos: DatosDeCierre): Promise<ResultadoCierre> {
    const response = await apiClient.post<ResultadoCierre>(
      `/denuncias/${denunciaId}/cierre`,
      datos,
    );
    return response.data;
  }
}

export const cierreService = new CierreService();
export default cierreService;
