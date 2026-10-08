# Cómo verificar una constancia probatoria

Este documento describe el procedimiento completo para comprobar la integridad de
una constancia emitida por el sistema, **sin consultarlo y sin confiar en él**.

Existe porque el sistema no tiene entidad administradora. No hay nadie a quien
enviarle un requerimiento oficial para que confirme si un registro es auténtico,
así que la constancia tiene que sostenerse sola. Cualquier persona con un equipo
y una implementación de SHA-256 puede ejecutar lo que sigue.

## Uso rápido

```bash
node tools/verificar-constancia.mjs constancia.json
```

El programa no usa bibliotecas externas ni código de este proyecto: solo el
módulo `crypto` de Node. Devuelve `0` si todo lo comprobable cuadra y `1` si algo
no. Es una implementación de referencia — reimplementarlo en otro lenguaje es
justamente lo que este documento permite.

## Formato

Una constancia es un JSON con `formato: "constancia-denuncia/v1"`. Trae, además
de los datos, una sección `verificacion` que **publica su propio procedimiento**:
el algoritmo, el separador y el orden exacto de los campos. Un verificador debe
leer el orden de ahí y no fijarlo en su código, para que el documento siga siendo
verificable si el formato evoluciona.

## Reglas de serialización

1. El algoritmo es **SHA-256**, sobre la codificación **UTF-8** del texto.
2. Los campos se unen con el separador **U+001F** (*unit separator*).
3. Un campo **nulo o ausente se une como cadena vacía**.
4. Las coordenadas viajan **ya redondeadas a 7 decimales, como cadena**. No se
   reformatean: se usan tal como aparecen.

> El separador no es un espacio a propósito. `texto_firmado` es un nombre
> completo, lleno de espacios; con un espacio como separador, los campos
> `«Ana Luz» + «Pérez»` y `«Ana» + «Luz Pérez»` producirían la misma cadena y por
> lo tanto el mismo hash. Dos declaraciones distintas quedarían selladas como si
> fueran una sola.

## Comprobaciones

### 1. Integridad de cada declaración

Une los campos de `verificacion.orden_campos_registro`, tomándolos de cada
elemento de `declaraciones`, y aplica SHA-256. El resultado debe ser igual a
`hash_registro`.

Si la declaración trae `firma_criptografica` (constancias `v3` en adelante),
agrega al final los campos de `verificacion.campos_registro_con_firma`: la
clave y la firma del teléfono también están selladas. Las declaraciones sin
firma, anteriores a ella, se unen sin esos campos y conservan su hash de siempre.

Si difiere, el registro fue alterado después de sellarse. Con firma, eso incluye
haberla quitado o cambiado.

### 2. El contenido de la denuncia

Une los campos de `verificacion.orden_campos_contenido`, tomándolos del objeto
`denuncia`, y aplica SHA-256. El resultado debe ser igual al
`hash_contenido_denuncia` de cada declaración.

Si difiere, la denuncia fue modificada después de declararse. Es lo que hace que
el contenido quede sellado en el instante de la firma, y la razón por la que la
edición se cierra al firmar.

### 3. El texto legal que se mostró

Para cada declaración, busca en `textos_legales` el elemento cuyo `id` coincida
con su `version_texto_legal_id`, aplica SHA-256 a su campo `texto` y compara con
`hash_texto_legal`.

Si difiere, el texto que se declara haber mostrado no es el que consta. La
constancia incluye el texto **entero**, no una referencia, precisamente para que
esta comprobación no dependa de pedirle nada al sistema.

### 4. La firma del dispositivo

Si la declaración trae `firma_criptografica` y `clave_publica`, arma el mensaje
que firmó el teléfono: `verificacion.firma.encabezado` y después los campos de
`verificacion.firma.orden_campos`, tomados de la declaración, **uno por línea**
(separados por U+000A, sin salto al final). Verifica sobre sus bytes UTF-8 la
firma **Ed25519** con `clave_publica`. La clave (32 bytes) y la firma (64 bytes)
vienen en hexadecimal.

El teléfono no firma `hash_registro`: ese hash lo calcula el servidor al sellar,
con su propia hora y el eslabón anterior de la cadena, y el teléfono no puede
conocerlo antes. Firma lo que la persona declaró: la denuncia, su contenido, el
texto legal que leyó, el vínculo y el nombre que escribió.

Es la comprobación más fuerte: la clave privada nunca sale del teléfono de quien
firmó, así que una firma válida descarta que el registro lo fabricara quien opera
el servidor.

## Lo que una constancia no demuestra

Decirlo es parte de que el documento sea honesto. Atribuirle más fuerza de la que
tiene sería el error opuesto al que este diseño intenta evitar.

**La posición dentro de la cadena.** La cadena de hashes es global: el
`hash_anterior` de una declaración apunta a la inmediatamente anterior *del
sistema entero*, que casi siempre pertenece a otra denuncia y no se incluye aquí
— publicarla revelaría datos de terceros. La constancia acredita la integridad de
cada registro, pero no su lugar exacto en la secuencia completa.

**La autenticidad frente al operador, si no hay firma.** Sin
`firma_criptografica`, todos los hashes los calculó el servidor. Sirven para
detectar una alteración *posterior*, pero no para descartar que el propio
operador fabricara el registro desde el principio. La firma del dispositivo es lo
único que cierra esa puerta, y por eso la constancia dice siempre, de forma
explícita, si la lleva o no.

**Quién tenía el teléfono en la mano.** La firma prueba que la hizo el teléfono
que guarda la clave. La aplicación pide desbloquearlo —código, huella o rostro—
antes de firmar, pero ese paso ocurre en el teléfono y no se puede comprobar
desde la constancia.
