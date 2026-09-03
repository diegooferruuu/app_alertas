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
   * Si todavía admite el interruptor.
   *
   * Las ya retiradas siguen apareciendo en la lista —la constancia probatoria
   * está disponible de forma indefinida y este es el camino hacia ella— pero no
   * se pueden volver a retirar: INVALIDADA es terminal.
   */
  puede_retirarse: boolean;
  created_at: string;
}

export interface ResultadoDesactivacion {
  desactivada: true;
  denuncia_id: string;
  mensaje: string;
  constancia_disponible: true;
}

class DesactivacionService {
  /**
   * Las denuncias vivas que identifican a la persona autenticada.
   *
   * No recibe a quién consultar: el servidor lo deduce del documento de la
   * sesión. No hay forma de preguntar por otro.
   */
  async misAlertas(): Promise<DenunciaQueMeIdentifica[]> {
    const response = await apiClient.get<DenunciaQueMeIdentifica[]>(
      '/desactivaciones/denuncias',
    );
    return response.data;
  }

  /** Retira una alerta que identifica a quien la ejecuta. No se puede deshacer. */
  async desactivar(denunciaId: string): Promise<ResultadoDesactivacion> {
    const response = await apiClient.post<ResultadoDesactivacion>(
      `/desactivaciones/${denunciaId}`,
    );
    return response.data;
  }
}

export const desactivacionService = new DesactivacionService();
export default desactivacionService;
