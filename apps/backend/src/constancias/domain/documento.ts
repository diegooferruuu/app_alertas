/**
 * Formato del documento de constancia probatoria (§6.2).
 *
 * El requisito que manda aquí es la **autoverificabilidad**: una autoridad tiene
 * que poder comprobar la integridad del registro sin consultar al sistema y sin
 * confiar en él. Eso obliga a que el documento traiga *todo* lo necesario para
 * recalcular los hashes, y a que el procedimiento sea público.
 *
 * Es necesario porque el sistema no tiene entidad administradora: no hay nadie a
 * quien enviarle un requerimiento oficial para que confirme que un registro es
 * auténtico. El documento tiene que sostenerse solo.
 */

/**
 * v2: el bloque `denuncia` pasó a traer todos los campos sellados en forma de
 * texto canónico, y `verificacion` declara con qué versión de fórmula se selló.
 *
 * v3: la firma del teléfono (H6.3). Cada declaración trae su clave pública, y
 * `verificacion` publica cómo se arma el mensaje firmado y qué campos se suman
 * al hash del registro cuando hay firma.
 *
 * El verificador distingue los formatos por el prefijo, no por el número: lee
 * de cada documento lo que ese documento publica.
 */
export const FORMATO_CONSTANCIA = 'constancia-denuncia/v3';

/** Orden exacto de los campos que entran en `hash_registro`. */
export const ORDEN_CAMPOS_REGISTRO = [
  'denuncia_id',
  'usuario_id',
  'ci_hash_declarante',
  'vinculo_declarado',
  'tipo',
  'version_texto_legal_id',
  'hash_texto_legal',
  'texto_firmado',
  'hash_contenido_denuncia',
  'firmada_en',
  'device_id',
  'hash_anterior',
] as const;

/**
 * El orden de los campos de contenido ya no vive aquí: depende de con qué
 * versión de fórmula se selló la denuncia, y lo publica cada constancia en
 * `verificacion.orden_campos_contenido`. Ver `declaraciones/domain/cadena.ts`.
 */

export const PROCEDIMIENTO_VERIFICACION = [
  'Une los campos indicados en `orden_campos_registro` con el separador U+001F. Un campo nulo se une como cadena vacía. Si la declaración tiene `firma_criptografica`, agrega al final los de `campos_registro_con_firma`.',
  'Aplica SHA-256 al resultado y compara con `hash_registro`. Si difiere, el registro fue alterado.',
  'Une los campos de `orden_campos_contenido` con el mismo separador, aplica SHA-256 y compara con `hash_contenido_denuncia`. Si difiere, la denuncia fue modificada después de declararse.',
  'Todos los valores de `denuncia` vienen ya en su forma canónica de texto: las coordenadas con 7 decimales, las fechas en ISO-8601 y los campos de valor múltiple unidos por coma en orden alfabético. Únelos tal como llegan, sin reformatearlos.',
  'Aplica SHA-256 al `texto` del texto legal correspondiente y compara con `hash_texto_legal`. Si difiere, el texto mostrado no es el que se declara.',
  'Si existe `firma_criptografica`, arma el mensaje firmado: `firma.encabezado` seguido de los campos de `firma.orden_campos`, uno por línea, separados por U+000A y sin salto final. Verifica sobre sus bytes UTF-8 la firma Ed25519 con `clave_publica`; la clave (32 bytes) y la firma (64 bytes) vienen en hexadecimal. Si es válida, la declaración la hizo el teléfono dueño de esa clave: ni el operador del sistema pudo fabricarla.',
];

/**
 * Lo que la constancia **no** demuestra por sí sola.
 *
 * Decirlo es parte de que el documento sea honesto. Omitirlo sería atribuirle
 * una fuerza probatoria que no tiene.
 */
export const LIMITES_VERIFICACION = [
  'La cadena de hashes es global: `hash_anterior` apunta a la declaración inmediatamente anterior del sistema, que casi siempre pertenece a otra denuncia y no se incluye aquí. Publicarla revelaría datos de terceros. Por eso esta constancia acredita la integridad de cada registro, pero no su posición dentro de la cadena completa.',
  'Sin `firma_criptografica`, todos los hashes fueron calculados por el servidor. Sirven para detectar una alteración posterior, pero no para descartar que el propio operador fabricara el registro desde el inicio. La firma del dispositivo es lo que cierra esa puerta; las declaraciones anteriores a ella no la tienen.',
  'La firma prueba que la hizo el teléfono que guarda esa clave. La aplicación pide desbloquearlo con su código, huella o rostro antes de firmar, pero eso no se puede comprobar desde este documento, y tampoco prueba quién tenía el teléfono en la mano.',
];
