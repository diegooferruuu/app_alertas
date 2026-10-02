import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/curves/abstract/utils';
import { declaracionService } from './denuncia.service';
import { DatosFirmados, mensajeAFirmar } from '../utils/mensaje-de-firma';

/** Por qué no se firmó, con el texto para decírselo a la persona. */
export class FirmaNoAutorizada extends Error {
  constructor(
    public readonly motivo: 'cancelada' | 'sin_bloqueo',
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/**
 * Pide desbloquear el teléfono con lo que la persona use para eso: código,
 * patrón, huella o rostro.
 *
 * Sin ningún bloqueo de pantalla no se firma: no habría nada que distinguiera a
 * la dueña del teléfono de cualquiera que lo tenga en la mano.
 *
 * Es un control de la aplicación, no de la clave: la privada está cifrada por
 * el sistema operativo, pero su uso lo condiciona este paso. La constancia lo
 * declara entre sus límites.
 */
async function confirmarQueEsLaPersona(): Promise<void> {
  const nivel = await LocalAuthentication.getEnrolledLevelAsync();
  if (nivel === LocalAuthentication.SecurityLevel.NONE) {
    throw new FirmaNoAutorizada(
      'sin_bloqueo',
      'Para firmar, tu teléfono necesita un bloqueo de pantalla: código, patrón, huella o rostro. Actívalo en los ajustes y vuelve a intentarlo.',
    );
  }
  const resultado = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Confirma que eres tú para firmar la declaración',
    cancelLabel: 'Cancelar',
    // Con `false`, el sistema acepta también el código del teléfono, no solo
    // la biometría: lo que la persona use para desbloquearlo.
    disableDeviceFallback: false,
  });
  if (!resultado.success) {
    throw new FirmaNoAutorizada(
      'cancelada',
      'Para firmar tienes que confirmar que eres tú con el desbloqueo de tu teléfono.',
    );
  }
}

/**
 * La clave Ed25519 de este teléfono para esta cuenta. La crea la primera vez.
 *
 * Se guarda en el almacén seguro del sistema, accesible solo con el teléfono
 * desbloqueado y sin copiarse a otro dispositivo en un respaldo. Por cuenta:
 * si otra persona inicia sesión en el mismo teléfono, firma con su propia
 * clave.
 */
async function claveDelTelefono(userId: string): Promise<{ semilla: Uint8Array; publica: string }> {
  const nombre = `clave-firma.${userId}`;
  let semillaHex = await SecureStore.getItemAsync(nombre);
  if (!semillaHex) {
    // La aleatoriedad la da el sistema (expo-crypto): la clave depende de ella.
    semillaHex = bytesToHex(Crypto.getRandomBytes(32));
    await SecureStore.setItemAsync(nombre, semillaHex, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  const semilla = hexToBytes(semillaHex);
  return { semilla, publica: bytesToHex(ed25519.getPublicKey(semilla)) };
}

/**
 * Firma lo declarado con la clave del teléfono, después de que la persona lo
 * desbloquee.
 *
 * Registra la clave antes de cada firma: el registro es idempotente, y así el
 * teléfono nunca firma con un identificador que el servidor ya no reconoce. La
 * privada no sale de aquí; al servidor llegan la pública y la firma.
 */
export async function firmarConElTelefono(
  userId: string,
  datos: DatosFirmados,
): Promise<{ clave_dispositivo_id: string; firma_dispositivo: string }> {
  await confirmarQueEsLaPersona();
  const { semilla, publica } = await claveDelTelefono(userId);
  const { id } = await declaracionService.registrarClave(publica);
  const firma = ed25519.sign(utf8ToBytes(mensajeAFirmar(datos)), semilla);
  return { clave_dispositivo_id: id, firma_dispositivo: bytesToHex(firma) };
}
