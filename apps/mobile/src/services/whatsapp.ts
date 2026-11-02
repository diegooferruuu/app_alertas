import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';

interface ModuloCompartirWhatsapp {
  enviarImagen(archivo: string, texto: string, numero: string): Promise<boolean>;
}

/**
 * El módulo nativo de `modules/compartir-whatsapp`, solo de Android.
 *
 * Nulo en iOS, en la web y en una app compilada antes de que existiera el
 * módulo: quien lo usa cae al menú de compartir del sistema en vez de cerrarse.
 */
const modulo =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<ModuloCompartirWhatsapp>('CompartirWhatsapp')
    : null;

/**
 * Abre el chat de WhatsApp de `numero` con la imagen y el texto adjuntos.
 *
 * `true` si WhatsApp se abrió; `false` si no se puede en este teléfono, y
 * entonces toca otro camino.
 */
export async function enviarImagenPorWhatsApp(
  archivo: string,
  texto: string,
  numero: string,
): Promise<boolean> {
  if (!modulo) return false;
  return modulo.enviarImagen(archivo, texto, numero);
}
