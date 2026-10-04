import * as SecureStore from 'expo-secure-store';
import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/curves/abstract/utils';
import { declaracionService } from './denuncia.service';
import { DatosFirmados, mensajeAFirmar } from '../utils/mensaje-de-firma';

/** Por qué no se firmó, con el texto para decírselo a la persona. */
export class FirmaNoAutorizada extends Error {
  constructor(
    public readonly motivo: 'cancelada' | 'sin_bloqueo' | 'sin_modulo',
    mensaje: string,
  ) {
    super(mensaje);
  }
}

type ModuloAutenticacion = typeof import('expo-local-authentication');
type ModuloCripto = typeof import('expo-crypto');

/**
 * Carga los módulos nativos de la firma al usarlos, no al importar este archivo.
 *
 * `expo-local-authentication` y `expo-crypto` buscan su parte nativa apenas se
 * importan, y lanzan si el build instalado no la trae. Esta pantalla se importa
 * desde `App.tsx`: importados arriba, en un teléfono con un build anterior la
 * app entera no abriría. Así, lo único que falla es firmar, con un mensaje que
 * dice qué hacer. Es el mismo criterio que `cargarNotificaciones`.
 *
 * Se comprueban las funciones y no solo que `require` no lance: cuando la
 * evaluación de un módulo revienta a medias, puede devolver un objeto
 * incompleto en vez de lanzar.
 */
function modulosNativos(): { autenticacion: ModuloAutenticacion; cripto: ModuloCripto } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const autenticacion: ModuloAutenticacion = require('expo-local-authentication');
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const cripto: ModuloCripto = require('expo-crypto');
    if (
      typeof autenticacion?.authenticateAsync === 'function' &&
      typeof autenticacion?.getEnrolledLevelAsync === 'function' &&
      typeof cripto?.getRandomBytes === 'function'
    ) {
      return { autenticacion, cripto };
    }
  } catch {
    // Cae al aviso de abajo.
  }
  throw new FirmaNoAutorizada(
    'sin_modulo',
    'Esta versión de la aplicación todavía no puede firmar. Instala la actualización y vuelve a intentarlo.',
  );
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
async function confirmarQueEsLaPersona(autenticacion: ModuloAutenticacion): Promise<void> {
  const nivel = await autenticacion.getEnrolledLevelAsync();
  if (nivel === autenticacion.SecurityLevel.NONE) {
    throw new FirmaNoAutorizada(
      'sin_bloqueo',
      'Para firmar, tu teléfono necesita un bloqueo de pantalla: código, patrón, huella o rostro. Actívalo en los ajustes y vuelve a intentarlo.',
    );
  }
  const resultado = await autenticacion.authenticateAsync({
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
async function claveDelTelefono(
  userId: string,
  cripto: ModuloCripto,
): Promise<{ semilla: Uint8Array; publica: string }> {
  const nombre = `clave-firma.${userId}`;
  let semillaHex = await SecureStore.getItemAsync(nombre);
  if (!semillaHex) {
    // La aleatoriedad la da el sistema (expo-crypto): la clave depende de ella.
    semillaHex = bytesToHex(cripto.getRandomBytes(32));
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
  const { autenticacion, cripto } = modulosNativos();
  await confirmarQueEsLaPersona(autenticacion);
  const { semilla, publica } = await claveDelTelefono(userId, cripto);
  const { id } = await declaracionService.registrarClave(publica);
  const firma = ed25519.sign(utf8ToBytes(mensajeAFirmar(datos)), semilla);
  return { clave_dispositivo_id: id, firma_dispositivo: bytesToHex(firma) };
}
