#!/usr/bin/env node
/**
 * Firma una denuncia como lo hace el teléfono. Para los datos de demostración.
 *
 *   node tools/firmar-como-telefono.mjs <api> <token> <denuncia_id> <vínculo> <nombre escrito>
 *
 * Desde la H6.3 el servidor no acepta una declaración sin la firma Ed25519 del
 * teléfono, así que un guion no puede firmar con un simple POST. Hace lo mismo
 * que la app: genera una clave, la registra, pide el hash del contenido y firma
 * lo declarado. La clave privada se descarta al terminar; la declaración sigue
 * siendo verificable con la pública, que queda registrada.
 *
 * Sin dependencias: `node:crypto` y `fetch`. El formato del mensaje es el de
 * `apps/backend/src/declaraciones/domain/firma-dispositivo.ts`; si cambia allá,
 * cambia aquí.
 */
import { generateKeyPairSync, sign } from 'node:crypto';

const [api, token, denunciaId, vinculo, nombre] = process.argv.slice(2);
if (!api || !token || !denunciaId || !vinculo || !nombre) {
  console.error('Uso: firmar-como-telefono.mjs <api> <token> <denuncia_id> <vínculo> <nombre escrito>');
  process.exit(2);
}

const pedir = async (metodo, ruta, cuerpo) => {
  const respuesta = await fetch(`${api}${ruta}`, {
    method: metodo,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new Error(`${metodo} ${ruta} → ${respuesta.status}: ${JSON.stringify(datos.message ?? datos)}`);
  }
  return datos;
};

try {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const clavePublica = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url').toString('hex');

  const { id: claveId } = await pedir('POST', '/declaraciones/claves', { clave_publica: clavePublica });
  const texto = await pedir('GET', '/declaraciones/texto-legal');
  const { hash_contenido_denuncia } = await pedir(
    'GET',
    `/declaraciones/denuncias/${denunciaId}/contenido`,
  );

  const mensaje = [
    'declaracion-jurada/v1',
    denunciaId,
    hash_contenido_denuncia,
    texto.hash_texto,
    vinculo,
    nombre,
  ].join('\n');

  const resultado = await pedir('POST', `/declaraciones/denuncias/${denunciaId}/firmar`, {
    version_texto_legal_id: texto.version_id,
    vinculo_declarado: vinculo,
    nombre_escrito: nombre,
    clave_dispositivo_id: claveId,
    firma_dispositivo: sign(null, Buffer.from(mensaje, 'utf8'), privateKey).toString('hex'),
  });
  console.log(resultado.nivel_confianza);
} catch (error) {
  console.error(`No se pudo firmar: ${error.message}`);
  process.exit(1);
}
