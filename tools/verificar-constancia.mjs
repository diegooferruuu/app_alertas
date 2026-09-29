#!/usr/bin/env node
/**
 * Verificador de constancias probatorias.
 *
 *   node tools/verificar-constancia.mjs constancia.json
 *
 * No depende de nada: ni de este repositorio, ni de bibliotecas externas, ni del
 * servidor que emitió el documento. Usa solo el módulo `crypto` de Node.
 *
 * Eso es el requisito, no una comodidad. El sistema no tiene entidad
 * administradora: no hay nadie a quien pedirle que confirme si un registro es
 * auténtico. La constancia tiene que sostenerse sola, y este programa es la
 * demostración de que se sostiene.
 *
 * Cualquiera puede reimplementarlo: el procedimiento va escrito dentro del
 * propio documento, en su sección `verificacion`.
 */

import { createHash, verify as verificarFirma, createPublicKey } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Separador de campos: «unit separator», U+001F. */
const SEP = '\x1F';

const sha256 = (texto) => createHash('sha256').update(texto, 'utf8').digest('hex');

/** Un campo nulo o ausente entra en la cadena como texto vacío. */
const unir = (objeto, campos) =>
  campos.map((campo) => objeto[campo] ?? '').join(SEP);

const VERDE = '\x1b[32m';
const ROJO = '\x1b[31m';
const AMARILLO = '\x1b[33m';
const GRIS = '\x1b[90m';
const FIN = '\x1b[0m';

const ok = (mensaje) => console.log(`  ${VERDE}✓${FIN} ${mensaje}`);
const mal = (mensaje) => console.log(`  ${ROJO}✗${FIN} ${mensaje}`);
const aviso = (mensaje) => console.log(`  ${AMARILLO}!${FIN} ${mensaje}`);

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: node verificar-constancia.mjs <constancia.json>');
  process.exit(2);
}

let doc;
try {
  doc = JSON.parse(readFileSync(ruta, 'utf8'));
} catch (error) {
  console.error(`No se pudo leer el documento: ${error.message}`);
  process.exit(2);
}

if (!doc.formato?.startsWith('constancia-denuncia/')) {
  console.error('El archivo no parece una constancia de este formato.');
  process.exit(2);
}

const ordenRegistro = doc.verificacion?.orden_campos_registro;
const ordenContenido = doc.verificacion?.orden_campos_contenido;
if (!Array.isArray(ordenRegistro) || !Array.isArray(ordenContenido)) {
  console.error('El documento no publica el orden de los campos. No es verificable.');
  process.exit(2);
}

console.log(`\nConstancia ${doc.formato}`);
console.log(`${GRIS}Denuncia ${doc.denuncia_id} · emitida ${doc.emitida_en}${FIN}\n`);

let fallos = 0;

// 1. El contenido de la denuncia, sellado en el instante de declarar.
const hashContenido = sha256(unir(doc.denuncia, ordenContenido));
console.log('Contenido de la denuncia');
const declaraciones = doc.declaraciones ?? [];
const contenidoCuadra = declaraciones.every(
  (d) => d.hash_contenido_denuncia === hashContenido,
);
if (declaraciones.length === 0) {
  aviso('El documento no contiene ninguna declaración.');
} else if (contenidoCuadra) {
  ok('La denuncia no fue modificada desde que se declaró.');
} else {
  mal('El contenido de la denuncia NO corresponde al sellado. Fue alterado.');
  fallos++;
}

// 2. Cada declaración: su propio hash y el texto legal que se mostró.
for (const [i, d] of declaraciones.entries()) {
  console.log(`\nDeclaración ${i + 1} de ${declaraciones.length} (${d.tipo})`);

  const hashCalculado = sha256(unir(d, ordenRegistro));
  if (hashCalculado === d.hash_registro) {
    ok('El registro corresponde a su hash: no fue alterado.');
  } else {
    mal('El registro NO corresponde a su hash. Fue alterado.');
    console.log(`${GRIS}      esperado: ${d.hash_registro}${FIN}`);
    console.log(`${GRIS}      calculado: ${hashCalculado}${FIN}`);
    fallos++;
  }

  const texto = (doc.textos_legales ?? []).find(
    (t) => t.id === d.version_texto_legal_id,
  );
  if (!texto) {
    aviso('El documento no incluye el texto legal de esta declaración.');
  } else if (sha256(texto.texto) === d.hash_texto_legal) {
    ok(`El texto legal mostrado es íntegro (versión ${texto.version}).`);
  } else {
    mal('El texto legal NO corresponde al que se declaró haber mostrado.');
    fallos++;
  }

  if (d.firma_criptografica && d.clave_publica) {
    try {
      const clave = createPublicKey(d.clave_publica);
      const valida = verificarFirma(
        null,
        Buffer.from(d.hash_registro, 'utf8'),
        clave,
        Buffer.from(d.firma_criptografica, 'base64'),
      );
      if (valida) {
        ok('Firma del dispositivo válida: ni el operador del sistema pudo fabricarla.');
      } else {
        mal('La firma del dispositivo NO es válida.');
        fallos++;
      }
    } catch (error) {
      mal(`No se pudo verificar la firma: ${error.message}`);
      fallos++;
    }
  } else {
    aviso(
      'Sin firma del dispositivo: la integridad se apoya en hashes que calculó el propio servidor.',
    );
  }
}

// 3. Los límites, que el documento declara por sí mismo.
if (doc.verificacion?.limites?.length) {
  console.log(`\n${GRIS}Lo que esta constancia no demuestra:${FIN}`);
  for (const limite of doc.verificacion.limites) {
    console.log(`${GRIS}  · ${limite}${FIN}`);
  }
}

console.log('');
if (fallos === 0) {
  console.log(`${VERDE}Verificación superada.${FIN} Todo lo comprobable cuadra.\n`);
  process.exit(0);
}
console.log(`${ROJO}Verificación fallida:${FIN} ${fallos} comprobación(es) no cuadran.\n`);
process.exit(1);
