import { apiClient } from './api';
import { storage } from '../utils/storage';

/** Por dónde se entregó el reporte. Es lo único que se le cuenta al servidor. */
export type CanalAvistamiento = 'LLAMADA' | 'MENSAJE';

/** A quién se entrega el reporte de avistamiento. */
export interface ContactoAutoridad {
  /** Lo que marca «Llamar». En producción, 110. */
  telefono: string;
  /** WhatsApp en dígitos, con código de país. Nulo: no hay botón de mensaje. */
  mensajeria: string | null;
}

const CLAVE_CONTACTO = 'contactoAutoridad';

class AvistamientoService {
  /**
   * A quién entregar el reporte.
   *
   * Lo dice el servidor —la app no tiene ningún número escrito, para que una
   * prueba no pueda terminar llamando a la línea de emergencia real— y se
   * guarda la última respuesta: avisar a la Policía no puede depender de tener
   * señal para consultar al servidor.
   */
  async contacto(): Promise<ContactoAutoridad | null> {
    try {
      const { data } = await apiClient.get<ContactoAutoridad>('/autoridad/contacto');
      await storage.setItem(CLAVE_CONTACTO, JSON.stringify(data));
      return data;
    } catch {
      try {
        const guardado = await storage.getItem(CLAVE_CONTACTO);
        return guardado ? (JSON.parse(guardado) as ContactoAutoridad) : null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Anota que se tocó un canal. Solo el canal y la alerta: el servidor no
   * recibe nada del avistamiento (I2).
   *
   * Se llama **después** de abrir el canal, y quien llama ignora su fallo: el
   * reporte no puede quedar esperando a una métrica.
   */
  async registrarUso(denunciaId: string, canal: CanalAvistamiento): Promise<void> {
    await apiClient.post(`/denuncias/${denunciaId}/uso-canal`, { canal });
  }
}

export const avistamientoService = new AvistamientoService();
export default avistamientoService;
