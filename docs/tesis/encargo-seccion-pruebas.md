# Encargo: redactar la sección de pruebas del proyecto de grado

- **Para:** Claude, en la conversación donde Diego Ferrufino escribe su documento de proyecto de grado.
- **De:** Claude Code, que trabajó sobre el código del sistema y midió todo lo que figura aquí el 5 de octubre de 2026.
- **Qué contiene:** las instrucciones para escribir la sección de pruebas y todos los datos que necesitas. Las cifras salen de ejecutar las pruebas; ninguna es una estimación.

## 1. Qué te pido

Redacta la sección de pruebas del documento de Diego, en español, con los datos de la sección 5. Tiene que mostrar cuatro cosas, en este orden de importancia:

1. Qué estrategia de pruebas se siguió y por qué.
2. Que cada invariante y cada requisito crítico del sistema está conectado con las pruebas que lo comprueban (trazabilidad).
3. Qué defectos encontraron las pruebas. Es lo que demuestra que sirvieron.
4. Qué no está probado (limitaciones), dicho con franqueza.

La cantidad de pruebas y la cobertura van como datos de apoyo, no como argumento principal.

Antes de escribir, pídele a Diego:

- El documento, o al menos un capítulo, para copiar su estilo, la numeración de capítulos, tablas y figuras, y el formato de citas.
- Dónde va la sección: capítulo propio o parte del capítulo de desarrollo.
- La lista de objetivos específicos. El tutor pidió que el Capítulo 4 se organice por objetivos específicos, no por sprints. Si las pruebas van dentro de ese capítulo, ubica la evidencia de cada objetivo en su sección, o añade a la matriz de trazabilidad una columna con el objetivo específico al que responde cada fila.

## 2. Reglas

- **Usa solo los datos de este archivo.** Si algo no está aquí, pregúntale a Diego. No inventes cifras, fechas, resultados ni nombres de pruebas.
- **Lo marcado `[COMPLETAR: …]` lo llena Diego.** Son sobre todo pruebas en el teléfono que él tiene que hacer o confirmar. No las des por hechas: deja el marcador visible en el borrador.
- **Registro académico**, impersonal («se ejecutaron», «se comprobó»), salvo que el documento use otro.
- **Cita las pruebas por su nombre textual**, entre comillas latinas: «rechaza eliminar una declaración». Están escritas en español y se leen como especificaciones; son la evidencia directa.
- **La cobertura se presenta por capa** y con sus huecos explicados (sección 5.4). Nunca como prueba de calidad: dice qué código se ejecutó, no si las pruebas comprueban lo correcto.
- **Las limitaciones no se maquillan.** Van en su propio apartado, con lo que haría falta para cerrarlas.
- **Lo extenso va a anexos:** la lista completa de pruebas (Anexo A de este archivo), la cobertura por módulo y la matriz de requisitos completa. En el cuerpo, las tablas resumidas.
- **Cada tabla** lleva número y título según el documento, y su fuente (por ejemplo, «Elaboración propia a partir de la ejecución de las pruebas del 05/10/2026»).

### Vocabulario del proyecto

El texto tiene que respetar estas reglas:

| No escribas | Escribe | Por qué |
|---|---|---|
| víctima | persona buscada, o persona reportada | No toda desaparición supone un delito. |
| identidad verificada, usuario validado | documento registrado | El OCR extrae datos; no autentica a nadie. |
| «el sistema verifica que la denuncia es cierta» | el sistema no comprueba la veracidad: garantiza la atribución | Es la idea central del diseño. |
| la comparación facial verifica la identidad | la comparación facial da un resultado consistente o no consistente | El umbral no está calibrado (ver limitaciones). |

Sí es correcto decir que una prueba «verifica» o «comprueba» un comportamiento, y que la constancia permite verificar la integridad de un registro.

## 3. Lo mínimo que debes saber del sistema

Es una aplicación de alerta temprana para personas desaparecidas en Bolivia. Quien denuncia registra su documento de identidad (con OCR y comparación facial), describe a la persona buscada en un formulario de campos cerrados y firma una declaración jurada con su teléfono. Al firmar, la alerta se difunde por notificación push a quienes están dentro de un radio de la última ubicación conocida (2 km, o 1 km si quien denuncia no es familiar) y aparece en el mapa durante 24 horas (12 si no es familiar). Quien la presentó puede prolongarla hasta tres veces sin volver a notificar a nadie. La persona reportada puede retirarla con «Estoy bien» o «Es falsa»; un «Es falsa» deja una falta a quien denunció.

**La idea central.** El sistema no comprueba que una denuncia sea cierta: en Bolivia no existe un servicio público para consultar el registro de identidad. La garantía pasa de la comprobación previa a la atribución posterior. Cada declaración queda asociada de forma inalterable a quien la hizo, mediante una cadena de hashes y una firma Ed25519 hecha en el teléfono, y cualquiera puede comprobar la integridad de la constancia sin consultar al sistema.

**Componentes.** Una API en NestJS 10 sobre Node.js; PostgreSQL 15 con PostGIS 3.5; un trabajador que envía las notificaciones en segundo plano; un planificador que marca las alertas vencidas; y una app móvil en React Native 0.86 con Expo SDK 57. La única dependencia externa es la pasarela de notificaciones (Expo, que entrega por APNs y FCM).

**Invariantes del diseño.** Romper uno es un defecto, no una opción de diseño. Varias pruebas los citan por su código:

| Código | Invariante |
|---|---|
| I1 | Crear una denuncia no es difundirla. |
| I2 | El contenido de un avistamiento nunca llega al servidor. |
| I3 | La persona buscada es el único sujeto identificable: ningún campo admite datos de terceros. |
| I4 | Las declaraciones juradas son de solo inserción. |
| I5 | Quien denuncia nunca sabe si el documento que reportó corresponde a una cuenta. |
| I6 | El OCR extrae datos; no autentica. |
| I7 | Nada se borra: ningún rol puede eliminar una denuncia, cerrar un caso ni suspender una cuenta; solo mecanismos automáticos. |
| I8 | Retirar una alerta no revela quién denunció. |
| I9 | Una falta aislada quita las funciones de denunciar, firmar y prolongar solo durante 7 días; la suspensión definitiva exige faltas de dos personas distintas. Las faltas no se borran. |
| I10 | Recibir alertas solo se pierde con la suspensión definitiva. Reportar un avistamiento no se restringe nunca: avisar a la Policía no usa la credibilidad del sistema. |
| I11 | Las faltas y los cierres son de solo inserción. |
| I12 | El estado de una cuenta se reconstruye desde su historial. |

Las pruebas del formulario de denuncia citan además cinco prohibiciones: P1 (sin texto libre), P3 (ningún dato de un tercero), P4 (ni recompensa ni contacto), P5 (sin narrar los hechos) y P6 (el número de documento nunca se guarda en claro).

## 4. Estructura sugerida

Adáptala a la del documento:

1. **Estrategia de pruebas:** niveles, qué prueba cada uno y por qué (5.1).
2. **Entorno y herramientas** (5.2).
3. **Resultados de la ejecución:** cantidades (5.3) y cobertura (5.4).
4. **Trazabilidad:** invariantes y requisitos → pruebas (5.5). En el cuerpo, la tabla de invariantes; la de requisitos completa, en un anexo.
5. **Casos de prueba representativos:** los 15 de 5.6, en el formato de caso de prueba que use el documento.
6. **Pruebas no funcionales:** rendimiento, fiabilidad y seguridad (5.7).
7. **Pruebas de sistema y en dispositivos** (5.8 y 5.9).
8. **Defectos encontrados** (5.10).
9. **Limitaciones** (5.11).
10. **Anexos:** lista completa de pruebas (Anexo A), cobertura por módulo y cómo reproducir (5.12).

## 5. Datos

### 5.1 Estrategia de pruebas

Tres niveles automatizados y dos de ejecución aparte:

| Nivel | Qué prueba | Cómo |
|---|---|---|
| Unitarias del backend | Reglas puras: cadena de hashes, firma Ed25519, máquina de estados de la denuncia, régimen de sanciones, reducción de la ubicación a ~1 km, minoría de edad, comparación de nombres y umbral facial. Además, la validación de la entrada (DTO), la configuración y el adaptador de la pasarela push con la red simulada. | Sin base de datos ni red. |
| Integración del backend | Los servicios contra PostgreSQL y PostGIS reales: creación, firma, difusión por radio, emisión y entregas, retiro y sanciones, constancias, avistamientos y texto legal. También el OCR y la comparación facial con sus motores reales. | Base `app_alertas_test`, migrada en cada ejecución. |
| Móvil | Funciones puras de la app: el mensaje que firma el teléfono, la firma Ed25519, el texto legal con el vínculo, la traducción de los rechazos del servidor, el reporte de avistamiento y el informe de ubicación. | Jest en Node, sin dibujar pantallas. |
| Sistema (HTTP) | Recorridos completos por la API, con un servidor real levantado aparte. | Ensayos con guiones (5.8). |
| Manual en dispositivos | Interfaz, notificaciones push, mapa y firma con desbloqueo del teléfono. | Android con build de desarrollo e iPhone con Expo Go (5.9). |

**Por qué la integración usa la base real y no una simulada.** Muchas garantías del sistema viven en la base de datos, no en el código:

- 5 disparadores que rechazan modificar o borrar declaraciones, prolongaciones, cierres, faltas y claves de firma.
- 33 restricciones CHECK y 13 índices únicos (por ejemplo, una sola denuncia abierta por denunciante y persona buscada), sobre 16 tablas.
- La consulta geográfica `ST_DWithin` que decide a quién alcanza una alerta.
- El `FOR UPDATE SKIP LOCKED` con el que el trabajador toma la cola de emisiones.

Una base simulada no ejecutaría nada de eso, y las pruebas solo dirían que el código llama a una función, no que la garantía se cumple.

**Aislamiento.** Antes de cada prueba se vacían las tablas de dominio (`TRUNCATE … RESTART IDENTITY CASCADE`), así cada caso empieza de cero. Las pruebas de integración corren en serie, en un solo proceso, porque comparten la base.

**Migraciones.** La base de pruebas no se genera desde las entidades: se le aplican las mismas migraciones que a la base real. Cada ejecución comprueba así, de paso, que las migraciones producen el esquema que el código espera.

**Qué se reemplaza por dobles.**

- La pasarela de notificaciones (Expo), solo en las pruebas de integración. La reemplaza un doble programable que puede aceptar, rechazar o caerse a mitad de un envío. El adaptador real de Expo tiene sus propias pruebas unitarias, con la red simulada.
- Nada más. El OCR (tesseract.js) y la comparación facial (face-api) se prueban con sus motores reales:
  - El OCR, sobre un carnet sintético con texto renderizado, para no guardar en el repositorio el documento de nadie.
  - La comparación facial, sobre fotos de muestra que trae la propia biblioteca, con una versión del mismo rostro degradada como la foto impresa de un carnet.

**Por qué la integración no levanta la aplicación entera.** Cada suite arma un módulo de prueba solo con las piezas que necesita, sin controladores y sin el planificador, que dejaría temporizadores vivos al terminar. Lo que se ejercita es el comportamiento contra la base, no el arranque. Por eso la capa HTTP casi no aparece en la cobertura (5.4) y se comprobó aparte, con los ensayos de 5.8.

**El móvil, una decisión explícita.** Se automatizaron las funciones que codifican reglas. Por ejemplo, si el mensaje que firma el teléfono difiriera en un solo byte del que reconstruye el servidor, ninguna firma verificaría. Las pantallas se comprobaron a mano en los dispositivos.

### 5.2 Entorno y herramientas

| Elemento | Versión |
|---|---|
| Equipo | Mac con Apple M2, macOS 26.6 |
| Node.js | 24.4.1 |
| Jest / ts-jest | 29.7.0 / 29.4.11 |
| TypeScript | 5.9.3 en el backend, 6.0.3 en el móvil |
| NestJS / TypeORM | 10.4.22 / 0.3.30 |
| PostgreSQL / PostGIS | 15.13 / 3.5.2, en Docker |
| Expo / React Native | SDK 57 (57.0.25) / 0.86.3 |
| Dispositivos | Android con build de desarrollo (EAS) e iPhone con Expo Go. [COMPLETAR: modelo y versión del sistema operativo de cada uno] |

### 5.3 Resultados: cantidad de pruebas

Ejecución del 05/10/2026 sobre la rama `Feature/Avistamientos`. [COMPLETAR: hash del commit con el que se midió.] Todas las pruebas pasaron; ninguna falló ni se omitió.

**Por nivel**

| Nivel | Suites | Pruebas | Superadas | Duración |
|---|---|---|---|---|
| Unitarias del backend | 19 | 201 | 201 | 7,6 s |
| Integración del backend | 10 | 273 | 273 | 36,3 s |
| Móvil | 6 | 34 | 34 | 3,4 s |
| **Total** | **35** | **508** | **508** | |

**Por módulo del backend**

| Módulo | Qué cubre | Unitarias | Integración | Total |
|---|---|---|---|---|
| denuncias | creación, difusión, caducidad, edición, fotografías, «La encontramos» | 64 | 68 | 132 |
| declaraciones | texto legal, firma, cadena de hashes, firma del teléfono, prolongaciones | 26 | 55 | 81 |
| alertas | emisión, entregas, recibos, pasarela push | 23 | 47 | 70 |
| cierres | retiro por la persona reportada, faltas y suspensión | 0 | 46 | 46 |
| verification | OCR, comparación facial, comparación de nombres | 24 | 15 | 39 |
| constancias | constancia autoverificable | 0 | 24 | 24 |
| config | validación del entorno y del número de la autoridad | 19 | 0 | 19 |
| users | cuentas, nombre, registro de documento | 8 | 10 | 18 |
| auth | validación del registro y del inicio de sesión (DTO) | 15 | 0 | 15 |
| sanciones | situación de una cuenta (reglas puras) | 13 | 0 | 13 |
| avistamientos | uso del canal de avistamiento | 3 | 8 | 11 |
| common | filtro de excepciones | 6 | 0 | 6 |
| **Total** | | **201** | **273** | **474** |

El régimen de sanciones también se ejercita en las pruebas de integración de `cierres`, `declaraciones` y `denuncias`, que lo aplican contra la base.

**Móvil por archivo**

| Archivo | Pruebas |
|---|---|
| `utils/reporte-avistamiento` | 12 |
| `components/mapa` (configuración del mapa) | 6 |
| `utils/texto-legal` | 5 |
| `services/restricciones` | 4 |
| `utils/mensaje-de-firma` | 4 |
| `services/ubicacion` | 3 |

### 5.4 Cobertura

**Cómo se midió.** Con Jest (instrumentación Istanbul), en una sola ejecución que corre juntas las pruebas unitarias y de integración del backend: 474 pruebas, 50,7 s con la instrumentación activa. Se mide sobre `src/**/*.ts`, sin los archivos de prueba, sin las migraciones (se comprueban al aplicarse en cada ejecución) y sin `main.ts` (el arranque).

**Total del backend:** líneas 70,2 % (1469 de 2094), ramas 73,4 % (345 de 470), funciones 70,3 % (263 de 374), sentencias 69,7 % (1633 de 2343).

**Por capa (la tabla que va en el cuerpo)**

| Capa | Archivos | Líneas | Ramas | Funciones |
|---|---|---|---|---|
| Dominio (reglas puras) | 15 | 97,9 % | 91,2 % | 100 % |
| Entidades (esquema) | 16 | 99,6 % | 100 % | 96,4 % |
| Servicios y trabajadores | 17 | 77,4 % | 72,1 % | 79,6 % |
| Adaptadores, configuración y otros | 20 | 75,3 % | 67,2 % | 64,0 % |
| DTO (validación de entrada) | 13 | 58,2 % | 50,0 % | 37,5 % |
| Controladores HTTP | 9 | 4,6 % | 0 % | 0 % |
| Cableado de módulos | 11 | 0 % | 0 % | 0 % |
| **Total** | **101** | **70,2 %** | **73,4 %** | **70,3 %** |

**Cómo leerla (explícalo en el texto):**

- Las reglas del dominio están cubiertas casi por completo. Lo que baja el total es la capa HTTP: controladores y cableado de módulos. Las pruebas de integración arman solo las piezas que necesitan (5.1), así que esa capa no se ejecuta en ellas. Se comprobó con los ensayos por HTTP de 5.8.
- En un DTO, la cobertura de líneas solo indica que la clase se cargó durante las pruebas. Los de registro, inicio de sesión y denuncia tienen además pruebas propias de sus reglas de validación. Los que aparecen en 0 % (firmar, prolongar o cerrar, entre otros) solo se cargan al pasar por la capa HTTP, que las pruebas automáticas no recorren.
- Sin pruebas automáticas (0 %): `auth.service` (registro, inicio de sesión y renovación de sesión) y `verification.service`, que coordina el OCR y la comparación facial en el registro del documento. Sus piezas sí están probadas: los DTO de registro y login, el lector OCR (93,9 %) y el comparador facial (90,1 %). Esto va en limitaciones.
- `emision.worker` y `recibos.worker` aparecen en 0 %, pero son envoltorios de pocas líneas que invocan cada minuto la lógica de `alertas.service`, y esa lógica sí está cubierta (`procesarPendientes`, `procesarRecibos`).
- `hilo-de-inferencia` aparece en 0 % aunque sí se ejecuta. Corre en un hilo aparte (worker thread) y la herramienta no lo mide. Lo ejercitan las pruebas «no congela el servidor mientras compara» y «si el hilo muere a mitad, esa comparación falla y la siguiente funciona».
- Las ramas exigen más que las líneas: cubrir una rama es recorrer cada alternativa de un `if`, no solo pasar por la línea.

**Por módulo del backend (para el anexo)**

| Módulo | Archivos | Líneas | Ramas | Funciones |
|---|---|---|---|---|
| sanciones | 7 | 84,8 % | 93,9 % | 90,5 % |
| users | 9 | 81,8 % | 75,0 % | 83,3 % |
| declaraciones | 15 | 81,3 % | 84,5 % | 85,5 % |
| denuncias | 14 | 78,3 % | 70,5 % | 78,1 % |
| constancias | 5 | 77,0 % | 76,5 % | 81,3 % |
| avistamientos | 5 | 73,2 % | — | 37,5 % |
| alertas | 15 | 72,3 % | 73,5 % | 75,9 % |
| cierres | 5 | 71,7 % | 96,8 % | 75,0 % |
| verification | 10 | 45,9 % | 31,7 % | 49,2 % |
| auth | 9 | 20,2 % | 22,2 % | 14,3 % |
| config | 3 | 98,1 % | 87,9 % | 87,5 % |
| common | 2 | 90,9 % | 76,2 % | 75,0 % |
| database | 1 | 100 % | 50,0 % | — |
| raíz (`app.module`) | 1 | 0 % | — | 0 % |

**Móvil.** Los archivos con pruebas están entre 90 y 100 %:

| Archivo | Líneas | Ramas | Funciones |
|---|---|---|---|
| `utils/mensaje-de-firma` | 100 % | 100 % | 100 % |
| `utils/texto-legal` | 100 % | 100 % | 100 % |
| `services/restricciones` | 100 % | 100 % | 100 % |
| `components/mapa/configuracion-del-apk` | 100 % | 100 % | 100 % |
| `utils/reporte-avistamiento` | 100 % | 75 % | 100 % |
| `services/ubicacion` | 90,9 % | 60 % | 100 % |

Sobre toda la lógica del móvil escrita en `.ts`, la cobertura es de 11,9 % de las líneas (58 de 486). El resto son los servicios que llaman a la API, el almacenamiento de la sesión y los hooks. Las 32 pantallas y componentes (`.tsx`, 7223 líneas) no tienen pruebas automáticas: se comprobaron a mano en los dispositivos. Preséntalo como una decisión: se automatizaron las reglas y la interfaz se valida en el teléfono.

### 5.5 Trazabilidad

Nivel: U = unitaria del backend, I = integración del backend, M = móvil. Los nombres son textuales.

#### 5.5.1 Invariantes (va en el cuerpo)

| Invariante | Pruebas que lo comprueban | Nivel |
|---|---|---|
| I1 · Crear no es difundir | «nace REGISTRADA, sin radio ni caducidad: existe pero no se difunde» · «una denuncia REGISTRADA no aparece en la consulta de cercanía» · «una denuncia REGISTRADA no se difunde, aunque esté activa» | I, I, U |
| I2 · El avistamiento no llega al servidor | ««registrarUso» no recibe al usuario: no hay forma de que llegue a la base ni al registro (I2)» · «la tabla no tiene dónde guardar a la persona, el lugar ni la hora del avistamiento (I2)» · «no escribe nada en el registro de la aplicación» · «no lleva el CI: quien recibe la alerta no lo tiene» | U, I, I, M |
| I3 · Solo la persona buscada es identificable | «el único campo de texto libre es el nombre de la persona buscada» · «rechaza el campo «presunto_responsable»» (y otros siete campos de terceros: acompañante, vehículo, placa, apodo, dirección, sospechoso, último contacto) · «rechaza narrar la circunstancia en vez de elegirla» · «rechaza el campo «recompensa»» | U |
| I4 · Declaraciones de solo inserción | «rechaza modificar una declaración ya firmada» · «rechaza modificar el hash para encubrir una alteración» · «rechaza eliminar una declaración» · «impide borrar la denuncia para arrastrar su declaración» · «una prolongación no se puede modificar ni borrar: es una firma» · «una clave registrada no se puede modificar ni borrar: sus firmas dejarían de verificarse» | I |
| I5 · Quien denuncia no sabe si el documento coincide | «la respuesta es indistinguible haya coincidencia o no» · «el bloqueo no revela qué cierre eligió la persona» · «devuelve el mismo error para una denuncia ajena que para una inexistente» | I |
| I6 · El OCR no autentica | «devuelve el texto crudo, sin interpretarlo» · «ninguno afirma que la identidad quedó verificada» · «nombra la ausencia de detección de vivacidad» · «admite que el umbral no está calibrado con datos etiquetados» | I, U, U, U |
| I7 · Nada se borra | «no borra la denuncia: queda invalidada y sigue siendo consultable (I7)» · «impide borrar la denuncia para arrastrar su declaración» · «tampoco al propio denunciante: no es una vía para borrar lo que uno firmó» | I |
| I8 · Retirar no revela quién denunció | «lista las denuncias que la identifican sin revelar quién denunció (I8)» · «el resultado no nombra al denunciante pero sí anuncia la constancia» · «la situación propia no revela la denuncia ni a la persona que la cerró» · «no expone el identificador de quien denunció» | I, I, I, U |
| I9 · Una falta: 7 días; definitiva: dos personas | «un «Es falsa» da una falta y siete días sin denunciar, no la suspensión definitiva (I9)» · «pasados los días de la falta vuelve a denunciar: una falta sola nunca suspende para siempre (I9)» · «dos personas distintas que la declaran falsa suspenden y bloquean el documento» · «la suspensión cuenta personas, no cierres: dos de la misma persona no bastan» · «una sola persona no alcanza para suspender de forma definitiva (I9)» | I, I, I, I, U |
| I10 · Recibir alertas y reportar avistamientos | «con una falta reciente no denuncia, no firma ni prolonga, pero sigue recibiendo alertas (I9)» · «suspendida pierde todo, incluso la recepción de alertas» · el reporte de avistamiento no puede restringirse por cuenta porque el servidor ni siquiera recibe al usuario (ver I2) | U, U |
| I11 · Faltas y cierres de solo inserción | «un cierre no se puede modificar ni borrar» · «una falta no se puede modificar ni borrar» · «el mismo hecho no produce dos faltas» | I |
| I12 · El estado se reconstruye del historial | «el estado guardado coincide con el que se deriva de los cierres (I12)» | I |

#### 5.5.2 Requisitos funcionales y de seguridad (va al anexo; en el cuerpo, un resumen)

| Requisito | Pruebas que lo comprueban | Nivel |
|---|---|---|
| La ubicación exacta nunca se guarda (zona de ~1 km) | «P·ubicación · no guarda el punto exacto que se envió» · «el punto guardado queda a menos de un kilómetro del real» · «es idempotente: reducir una zona ya reducida no la mueve» · «dos puntos de la misma manzana caen en la misma zona» | I, U, U, U |
| El número de documento solo se guarda como hash (P6) | «P6 · el documento no queda en claro en ninguna columna ni en los registros» · «el documento se guarda solo como hash, nunca en claro» · «un mismo documento no puede registrarse en dos cuentas» | I |
| La alerta de un menor no lleva fotografía | «rechaza la denuncia de un menor que trae fotografía» · «corregir la fecha a la de un menor retira la fotografía ya guardada» · «se mide contra hoy, no contra cuándo desapareció» | I, I, U |
| Formulario de campos cerrados (P1, P4, P5) | «rechaza el antiguo campo de relato libre» · «un valor fuera del dominio se rechaza aunque se parezca al correcto» · «la base rechaza un valor fuera del dominio aunque se escriba directo» · «la circunstancia es obligatoria y de dominio cerrado» | U, U, I, U |
| La firma exige el nombre completo escrito a mano | «rechaza un nombre incompleto: se firma con el nombre entero» · «acepta el nombre sin tildes y con mayúsculas distintas» · «rechaza el orden alterado: no es el mismo nombre» | I, I, U |
| Integridad del paquete probatorio (cadena de hashes) | «encadena los registros: el segundo apunta al hash del primero» · «detecta el registro alterado y señala cuál» · «detecta que se suprimió un registro intermedio» · «la cadena almacenada se verifica sin errores» · «distingue campos con espacios: el separador no puede ser un espacio» | I, U, U, I, U |
| Firma Ed25519 hecha en el teléfono | «cumple el vector 1 de la RFC 8032, el mismo que usa la prueba del teléfono» · «cumple el vector 1 de la RFC 8032, el mismo que verifica el servidor» · «arma exactamente el mismo mensaje que el servidor» · «rechaza una firma que no corresponde a lo declarado, y no sella nada» · «rechaza la clave de otra cuenta, aunque la firma sea válida para esa clave» · «si la denuncia cambia después de firmarse en el teléfono, la firma ya no vale» | U, M, M, I, I, I |
| Constancia que se comprueba sin el sistema | «la firma se verifica con lo publicado, sin preguntarle nada al sistema» · «el verificador publicado la acepta, acepta una sin firma y rechaza una alterada» · «altera un campo y el hash deja de cuadrar» · «declara con franqueza lo que no demuestra» · «a un tercero le responde como si la denuncia no existiera» | I |
| Texto legal versionado | «sella la versión del texto legal que se mostró, no «la vigente»» · «detecta que el texto fue alterado sin actualizar su hash» · «impide que dos versiones estén vigentes a la vez» · «escribe el vínculo elegido en lugar del marcador» | I, I, I, M |
| Difusión solo dentro del radio | «alcanza a quien está dentro del radio del caso» · «no alcanza a quien está fuera del radio» · «excluye a quien no reporta ubicación desde hace demasiado» · «no alerta a quien denunció: ya conoce el caso» · «un tercero no familiar entra con menos alcance y menos plazo, no rechazado» | I |
| Emisión sin pérdidas ni duplicados | «retoma una emisión que quedó «procesando» porque el proceso murió» · «un fallo al cerrar la emisión no vuelve a notificar a nadie» · «si la pasarela cae a mitad, el reintento solo repite el lote sin confirmar» · «no toma una emisión que otro trabajador está procesando» · «la base rechaza dos entregas de la misma emisión al mismo teléfono» | I |
| Emisión a escala de ciudad | «registra completa una emisión a 20 000 destinatarios» | I |
| Medición de la entrega (recibos) | «un recibo positivo deja la entrega despachada sin mover la latencia de envío» · «pasadas 24 horas sin recibo la da por perdida, sin preguntar» · «permite medir la latencia entre encolar y emitir» | I |
| Caducidad: una alerta vencida no se difunde | «una alerta vencida no se difunde aunque su estado siga ACTIVA» · «marca las vencidas y conserva hasta dónde y hasta cuándo se difundieron» · «descarta la emisión de una alerta vencida aunque el planificador no la haya marcado» · «descarta la emisión si la denuncia caducó antes de procesarse» | I |
| Prolongar sin notificar, con tope | «la mantiene a la vista otro plazo, contado desde ahora, sin notificar a nadie» · «al devolver a la vista una vencida no suelta la notificación que no alcanzó a salir» · «tiene un tope: la cuarta se rechaza» · «queda firmada, y la firma de una prolongación no sirve para la siguiente» | I |
| Límite de dos alertas difundiéndose por cuenta | «no difunde una tercera alerta a la vez» · «las vencidas no cuentan para el límite» · «devolver a la vista una vencida cuenta para el límite de alertas» | I |
| Una denuncia abierta por denunciante y persona | «no admite una segunda denuncia abierta sobre la misma persona» · «la regla es de cada denunciante: otra persona sí puede denunciar a la misma» · «dos envíos simultáneos: uno se registra y el otro recibe el 409» | I |
| Aviso a la persona reportada | «encola un aviso directo cuando la persona reportada tiene cuenta» · «avisa al crear, sin esperar a que la denuncia se difunda» · «encola el aviso de una denuncia activa que ya identificaba a la persona» | I |
| Retiro por la persona reportada | «permite cerrarla a quien el documento de la denuncia identifica» · ««Es falsa» siempre bloquea volver a denunciar, aunque se pida lo contrario» · «si el registro falla, nada queda a medias: ni invalidada, ni falta, ni bloqueo» · «con la primera falta, sus otras alertas dejan de difundirse en el mismo acto» | I |
| «La encontramos» | «quien la presentó la da por terminada: deja de difundirse y queda la fecha» · «revoca lo que todavía no salió» · «todavía se puede declarar falsa, y deja la falta» | I |
| Configuración segura del servidor | «rechaza los valores de ejemplo publicados en el repositorio» · «rechaza un secreto de menos de 32 caracteres» · «fuera de producción no arranca apuntando al 110» · «no repite el número en el error: puede ser el celular de alguien» | U |
| Registro del documento: OCR y comparación facial | «lee el número de documento» · «lee el apellido» · «una imagen ilegible es error del cliente, no del servidor» · «reconoce el mismo rostro pese a la degradación de un carnet» · «rechaza a otra persona» · «no congela el servidor mientras compara» | I |

### 5.6 Casos de prueba representativos

Quince casos, uno por requisito crítico. Todos dieron un resultado conforme el 05/10/2026. Adapta las columnas al formato de caso de prueba del documento.

| ID | Requisito | Precondición | Acción | Resultado esperado | Pruebas automatizadas |
|---|---|---|---|---|---|
| CP-01 | I1 · Crear no es difundir | Cuenta con documento registrado | Crear una denuncia válida sin firmarla | Queda REGISTRADA, sin radio ni plazo, y no aparece en la consulta de cercanía | «nace REGISTRADA, sin radio ni caducidad: existe pero no se difunde» · «una denuncia REGISTRADA no aparece en la consulta de cercanía» |
| CP-02 | Ubicación reducida | — | Crear una denuncia con un punto preciso | La base guarda el centro de la celda de ~1 km, a menos de 1 km del punto real, nunca el punto enviado | «P·ubicación · no guarda el punto exacto que se envió» · «el punto guardado queda a menos de un kilómetro del real» |
| CP-03 | I5 · Sin oráculo de coincidencia | Un documento con cuenta y otro sin ella | Denunciar sobre cada uno | Respuestas indistinguibles; el aviso a la persona se encola solo en el primer caso | «la respuesta es indistinguible haya coincidencia o no» · «encola un aviso directo cuando la persona reportada tiene cuenta» |
| CP-04 | Firma con el nombre escrito | Denuncia registrada | Firmar con el nombre incompleto; después, sin tildes | Rechaza el incompleto; acepta el escrito sin tildes | «rechaza un nombre incompleto: se firma con el nombre entero» · «acepta el nombre sin tildes y con mayúsculas distintas» |
| CP-05 | Firma del teléfono | Clave registrada | Enviar una firma Ed25519 hecha sobre otro mensaje, o con la clave de otra cuenta | Rechazo; no se sella nada | «rechaza una firma que no corresponde a lo declarado, y no sella nada» · «rechaza la clave de otra cuenta, aunque la firma sea válida para esa clave» |
| CP-06 | I4 · Solo inserción | Declaración firmada | `UPDATE` y `DELETE` directos en la base | La base los rechaza y la declaración sigue intacta | «rechaza modificar una declaración ya firmada» · «rechaza eliminar una declaración» · «la declaración sigue ahí tras los intentos fallidos» |
| CP-07 | Integridad comprobable | Constancia emitida | Alterar un campo de la constancia; suprimir un registro de la cadena | El hash recalculado deja de coincidir; el verificador independiente la rechaza; la supresión se detecta | «altera un campo y el hash deja de cuadrar» · «el verificador publicado la acepta, acepta una sin firma y rechaza una alterada» · «detecta que se suprimió un registro intermedio» |
| CP-08 | Difusión por radio | Vecinos dentro y fuera del radio, uno con ubicación antigua, y el autor | Procesar la emisión | Solo recibe quien está dentro del radio, con ubicación reciente y no es el autor | «alcanza a quien está dentro del radio del caso» · «no alcanza a quien está fuera del radio» · «excluye a quien no reporta ubicación desde hace demasiado» · «no alerta a quien denunció: ya conoce el caso» |
| CP-09 | Emisión fiable | Emisión en curso | Simular que el proceso muere a mitad, que falla al cerrar la emisión y que la pasarela cae a mitad | Se retoma; nadie recibe la alerta dos veces, salvo como mucho el lote de 100 que estaba en vuelo | «retoma una emisión que quedó «procesando» porque el proceso murió» · «un fallo al cerrar la emisión no vuelve a notificar a nadie» · «si la pasarela cae a mitad, el reintento solo repite el lote sin confirmar» |
| CP-10 | Escala | 20 000 vecinos dentro del radio | Procesar una emisión | Se registran las 20 000 entregas | «registra completa una emisión a 20 000 destinatarios» |
| CP-11 | Caducidad | Alerta con el plazo cumplido, aún sin marcar como vencida | Procesar su emisión pendiente | Se descarta sin enviar | «descarta la emisión de una alerta vencida aunque el planificador no la haya marcado» · «una alerta vencida no se difunde aunque su estado siga ACTIVA» |
| CP-12 | Prolongar sin notificar | Alerta vigente; otra vencida con su notificación pendiente | Prolongar ambas; intentar una cuarta prolongación | No se encola ninguna notificación; la pendiente de la vencida se anula; la cuarta se rechaza | «la mantiene a la vista otro plazo, contado desde ahora, sin notificar a nadie» · «al devolver a la vista una vencida no suelta la notificación que no alcanzó a salir» · «tiene un tope: la cuarta se rechaza» |
| CP-13 | I9 · Régimen de faltas | Una cuenta con dos alertas difundiéndose | La persona reportada declara falsa una; luego otra persona distinta declara falsa otra | Primera: falta, 7 días sin denunciar y sus otras alertas dejan de difundirse. Segunda persona: suspensión definitiva y documento bloqueado | «un «Es falsa» da una falta y siete días sin denunciar, no la suspensión definitiva (I9)» · «con la primera falta, sus otras alertas dejan de difundirse en el mismo acto» · «dos personas distintas que la declaran falsa suspenden y bloquean el documento» |
| CP-14 | I2 · Avistamiento fuera del servidor | Alerta difundida | Registrar el uso del canal de avistamiento | Solo se guardan la denuncia, el canal y la hora al minuto; no hay columna para la persona, el lugar ni la hora exacta | «la tabla no tiene dónde guardar a la persona, el lugar ni la hora del avistamiento (I2)» · «la hora queda truncada al minuto» · ««registrarUso» no recibe al usuario: no hay forma de que llegue a la base ni al registro (I2)» |
| CP-15 | Menores sin fotografía | — | Crear la denuncia de un menor con fotografía; corregir a la de un menor la fecha de nacimiento de una que ya tiene foto | Se rechaza; la foto guardada se retira | «rechaza la denuncia de un menor que trae fotografía» · «corregir la fecha a la de un menor retira la fotografía ya guardada» |

### 5.7 Pruebas no funcionales

**Rendimiento.** Mediciones en el equipo de 5.2:

| Medición | Antes | Después | Fecha |
|---|---|---|---|
| Emisión a 20 000 destinatarios | Fallaba entera: PostgreSQL admite 65 535 parámetros por sentencia, lo que ponía un techo de ~13 100 destinatarios | Completa. La prueba entera, siembra de vecinos incluida, tarda entre 6,4 y 7,9 s | 23–24/09/2026 y 04/10/2026 |
| Emisión a 12 000 destinatarios (misma siembra) | 27,6 s | 1,2 s | 23/09/2026 |
| Bloqueo del servidor por cada comparación facial | 190–293 ms | ~6 ms, al moverla a un hilo aparte (el tiempo total de la comparación sigue en ~390 ms) | 29/09/2026 |
| Lectura OCR en el registro | Se creaba y destruía un trabajador por documento | Se reutiliza: unos 160 ms menos por registro | 14/09/2026 |
| Latencia entre la firma y la aceptación por la pasarela, en una entrega real | — | 3,4 s | 24/09/2026 |

La latencia real es un único dato: no se puede generalizar. El sistema la registra en cada emisión (`emisiones_alerta.creada_en` frente a `emitida_en`, y la hora de aceptación de cada entrega), así que se puede medir con más casos. Las consultas están en `tools/metricas-entrega.sql`.

**Fiabilidad.** La emisión sigue la semántica «al menos una vez, con duplicado acotado»:

- Se envía y se registra lote a lote (100 por lote), así que un fallo repite como mucho el lote en vuelo.
- Un índice único impide dos entregas de la misma emisión al mismo teléfono.
- Un arrendamiento con vencimiento (5 min) permite retomar la emisión de un proceso que murió a mitad.

Las pruebas de CP-09 lo comprueban fallo por fallo.

**Seguridad e integridad:**

- Firma Ed25519 comprobada con el vector 1 de la RFC 8032 en los dos extremos (servidor y teléfono).
- Constancia autoverificable, con un verificador independiente (`tools/verificar-constancia.mjs`) que se prueba desde la suite.
- Disparadores de solo inserción en las cinco tablas del registro probatorio.
- El servidor no arranca con secretos ausentes, de menos de 32 caracteres, iguales entre sí o iguales a los valores de ejemplo publicados.
- El número de documento se guarda solo como hash, y la ubicación exacta no se guarda nunca.

### 5.8 Pruebas de sistema por HTTP

Ensayos con un servidor real levantado aparte contra la base de pruebas, con la pasarela push simulada para no enviar notificaciones reales:

| Fecha | Qué se comprobó | Resultado |
|---|---|---|
| 28/09/2026 | Arranque con los secretos de ejemplo publicados y con secretos nuevos | Con los publicados se niega a arrancar; con los nuevos arranca |
| 01/10/2026 | Rutas de avistamiento | Sin sesión, 401; contacto de la autoridad, 200; registro del uso del canal, 204; un campo `lat` en el registro se rechaza con 400; con el 110 como número de la autoridad fuera de producción, el servidor no arranca |
| 01/10/2026 | Guion de datos de demostración (`tools/datos-demo.sh`) | Firma desde el «teléfono», constancia verificada, «Es falsa» y limpieza al repetirlo |
| 04/10/2026 | Prolongar una alerta | 201. Reenviar la misma firma, 400. Desde otra cuenta, 403. Tras un «Es falsa», la cuenta autora recibe 403 `CUENTA_SUSPENDIDA_TEMPORALMENTE` con la fecha de fin en hora de La Paz |
| 04/10/2026 | Alerta vencida devuelta a la vista | 201, con 24 h de plazo y 2 prolongaciones restantes. Vuelve al mapa de otra cuenta. La notificación pendiente quedó anulada. La constancia pasa el verificador. Repetir el guion limpia también la prolongación |

Otras comprobaciones:

- **Esquema (04/10/2026):** `schema:log` sin diferencias. El esquema que producen las migraciones coincide con el que declaran las entidades.
- **Reversión de migraciones:** en las de sanciones, avistamientos, emisión fiable y recibos de entrega se probó también el `down`.
- **Compilación:** `tsc` sin errores en backend y móvil; `expo export` de Android e iOS sin errores; `expo-doctor` 21/21 (24/09/2026).

### 5.9 Pruebas manuales en dispositivos

| Prueba | Dispositivo | Resultado | Fecha | Evidencia |
|---|---|---|---|---|
| Notificación push de punta a punta: una denuncia firmada en un teléfono llega a otro dentro del radio | Android (build de desarrollo, FCM) | Llegó | 24/09/2026 | [COMPLETAR: captura] |
| Mapa con Google Maps | Android | Funciona | 04/10/2026 | [COMPLETAR: captura] |
| La app ya no informa la ubicación cada segundo | Android | Corregido y confirmado | 04/10/2026 | — |
| Los marcadores siguen al volver a la pestaña del mapa; tocar el recuadro abre el detalle | Android | Funciona | 04/10/2026 | [COMPLETAR: captura] |
| Datos de demostración con una alerta vigente y otra vencida | — | Correcto | 05/10/2026 | — |
| Registro del documento con OCR y selfie | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Firma de la declaración con desbloqueo (huella, rostro o código) | [COMPLETAR: Android / iPhone] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| El vínculo elegido aparece escrito dentro del texto legal | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| «Volver a mostrar la alerta»: vuelve al mapa y no llega ninguna notificación | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| «Es falsa» → «Mi situación» muestra la falta y los 7 días | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Reporte de avistamiento por llamada y por WhatsApp | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Prueba negativa: una denuncia lejana (fuera del radio) no notifica | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Constancia exportada desde el teléfono y comprobada con `node tools/verificar-constancia.mjs` | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Mapa y recuadro en iPhone | iPhone | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |

[COMPLETAR: ¿hubo pruebas con usuarios (encuestas, cuestionario SUS, tareas observadas)? Si las hubo, van en su propio apartado; si no, decláralo en las limitaciones.]

### 5.10 Defectos encontrados

Esta sección demuestra el valor de las pruebas. Las marcadas con ★ son las imprescindibles.

| Fecha | Defecto | Cómo se detectó | Corrección | Prueba que lo protege |
|---|---|---|---|---|
| ★ 23/09/2026 | Emitir a más de ~13 100 destinatarios fallaba entera, sin avisar a nadie: PostgreSQL admite 65 535 parámetros por sentencia. El error ni siquiera lo decía («bind message has 34464 parameter formats but 0 parameters») | Prueba de escala con 20 000 destinatarios | Los valores viajan como arreglos que el servidor expande (`unnest`): número fijo de parámetros. De paso, 12 000 destinatarios bajaron de 27,6 s a 1,2 s | «registra completa una emisión a 20 000 destinatarios» |
| ★ 24/09/2026 | Una emisión cuyo proceso moría quedaba «procesando» para siempre y la alerta no salía; y un fallo al cerrar la emisión volvía a notificar a todos (6 envíos para 3 vecinos) | Pruebas escritas contra el código anterior | Arrendamiento con vencimiento, índice único por emisión y teléfono, y envío lote a lote | «retoma una emisión que quedó «procesando» porque el proceso murió» · «un fallo al cerrar la emisión no vuelve a notificar a nadie» |
| ★ 14/09/2026 | Subir un archivo corrupto como documento tumbaba el servidor: el motor de OCR lanzaba un error desde su hilo, fuera del alcance de cualquier `try/catch` | Prueba de integración con una imagen ilegible | Manejador de errores en el trabajador de OCR | «una imagen ilegible es error del cliente, no del servidor» · «sigue leyendo después de una imagen ilegible» |
| ★ 01/10/2026 | La consulta del detalle de una denuncia devolvía cualquier denuncia a cualquier persona con sesión, incluidas las no firmadas («solo tú la ves») y las retiradas por la persona reportada | Revisión de código | Visibilidad por autor y estado; una oculta responde igual que una inexistente | «una sin firmar solo la ve su autor» · «una que la persona reportada cerró ya no la ven los vecinos» · «una oculta responde igual que una que no existe» |
| ★ 04/10/2026 | El trabajador podía notificar una alerta ya vencida si el servidor estuvo caído más de un día: corre al minuto de arrancar y el planificador recién a los cinco | Revisión al preparar los datos de demostración | El trabajador descarta por plazo, no solo por estado | «descarta la emisión de una alerta vencida aunque el planificador no la haya marcado» |
| ★ 04/10/2026 | «Volver a mostrar» una alerta vencida podía enviar la notificación que no alcanzó a salir, contra lo que la app promete («No se enviará ninguna notificación») | Ensayo por HTTP | Al devolver a la vista una vencida se anula la difusión pendiente; el aviso a la persona reportada se mantiene | «al devolver a la vista una vencida no suelta la notificación que no alcanzó a salir» |
| 28/09/2026 | Los secretos que firman las sesiones eran los valores de ejemplo publicados en el repositorio, que es público: cualquiera podía firmar sesiones válidas | Revisión de seguridad | Secretos nuevos; el servidor se niega a arrancar con secretos publicados, cortos o iguales | «rechaza los valores de ejemplo publicados en el repositorio» · «rechaza el mismo valor para los dos secretos» |
| 14/09/2026 | Una petición demasiado grande devolvía 500 en lugar de 413 | Al enviar fotos de 12 MP desde el teléfono | El filtro de excepciones respeta los errores del middleware; además, las fotos se reducen a 1600 px antes de enviarse | «un cuerpo demasiado grande devuelve 413, no 500» |
| 14/09/2026 | Un correo con la inicial en mayúscula o con un espacio al final no permitía iniciar sesión | Uso en el teléfono (el teclado capitaliza la primera letra) | Forma canónica del correo y una restricción en la base | «pasa a minúsculas: el teclado del teléfono capitaliza la primera letra» · «recorta los espacios que deja el autocompletado» |
| 04/10/2026 | En Android la app pedía la ubicación cada segundo: un pedido de permiso dentro del oyente de primer plano generaba un ciclo | Prueba en el teléfono | Los permisos se piden al entrar; al volver al primer plano solo se consultan, con un mínimo de 5 min entre informes | «al volver al primer plano no abre ninguna pantalla del sistema» |
| 04/10/2026 | La declaración mostraba el marcador `{{VINCULO}}` sin reemplazar | Prueba en el teléfono | El vínculo se elige antes de leer el texto y se escribe en su lugar | «escribe el vínculo elegido en lugar del marcador» · «el texto vigente nombra el vínculo una vez, con el marcador que la app reemplaza por el elegido» |
| 04/10/2026 | En Android los marcadores del mapa desaparecían al volver a la pestaña: es un fallo abierto de la biblioteca react-native-maps (#6015) | Prueba en el teléfono | Se desmonta el mapa al salir de la pestaña y se recupera la cámara al volver | Sin prueba automática (es interfaz): se comprobó en el teléfono |
| 01/10/2026 | La propia suite del texto legal borraba la versión 1 y restauraba la vigente con el texto equivocado: un defecto de las pruebas, no del sistema | Al cambiar la versión vigente del texto | La suite conserva las versiones que siembran las migraciones y restaura el texto que había | (La suite misma) |

### 5.11 Limitaciones

- **Sin pruebas automáticas de extremo a extremo por HTTP.** Controladores y cableado no se ejecutan en las pruebas automáticas (4,6 % y 0 %). Se comprobaron con los ensayos de 5.8. Para cerrarlo: pruebas que levanten la aplicación completa y la recorran por HTTP.
- **`auth.service` y `verification.service` sin pruebas automáticas.** Son el registro, el inicio y la renovación de sesión, y la coordinación del registro del documento. Sus piezas sí están probadas (5.4), pero no el servicio que las une.
- **La interfaz del móvil se comprueba a mano.** Son 32 pantallas y componentes. No hay pruebas automáticas de interfaz.
- **Comparación facial:** el umbral no está calibrado con datos etiquetados de carnets bolivianos, así que sus tasas de falsa aceptación y falso rechazo son desconocidas, y no hay detección de vivacidad: una foto impresa frente a la cámara pasaría. Las propias pruebas lo declaran («nombra la ausencia de detección de vivacidad», «admite que el umbral no está calibrado con datos etiquetados»).
- **OCR** probado sobre un carnet sintético, no sobre un conjunto de fotografías reales.
- **Notificaciones push** probadas en pocos dispositivos. Falta la prueba negativa de una denuncia lejana. La única latencia real medida es un dato aislado.
- **Un solo entorno de ejecución** (5.2). No hubo prueba de carga del sistema completo por HTTP; la carga se probó en la emisión (20 000 destinatarios).
- **La cobertura mide qué se ejecutó, no la calidad de las aserciones.**
- [COMPLETAR: pruebas con usuarios, si no las hubo.]

### 5.12 Cómo reproducir

Con Docker en marcha:

```bash
docker compose up -d
pnpm --dir apps/backend test
pnpm --dir apps/backend test:integration
pnpm --dir apps/mobile test
```

- El primero levanta PostgreSQL con PostGIS.
- Los dos siguientes corren las 201 pruebas unitarias y las 273 de integración del backend. Las de integración crean y migran la base `app_alertas_test` si hace falta.
- El último corre las 34 pruebas del móvil.

La cobertura del backend se midió en una sola ejecución de Jest que combina las configuraciones unitaria e de integración, con `collectCoverageFrom` sobre `src/**/*.ts` y sin pruebas, migraciones ni `main.ts`.

## Anexo A. Lista completa de las 508 pruebas

Generada desde los resultados de Jest del 05/10/2026, agrupada por nivel y por archivo. Los subtítulos en cursiva son los grupos (`describe`) dentro de cada archivo. Todas pasaron.

### Unitarias del backend — 201 pruebas en 19 suites

**`src/alertas/pasarela-push-expo.spec.ts`** (23)

- no sale a la red si no hay nada que enviar
- guarda el identificador del ticket de un envío aceptado
- manda canal y prioridad alta
- da de baja el token que la pasarela reporta desinstalado
- otros errores de ticket no dan de baja el token
- parte en lotes de 100
- un corte de red falla el lote sin dar de baja a nadie
- una respuesta de error de la pasarela falla el lote
- un rechazo de la petición completa falla el lote
- si no viene un ticket por mensaje, no se atribuye ninguno
- manda la credencial cuando está configurada
- sin credencial no manda cabecera de autorización
- *recibos*
  - no sale a la red si no hay tickets
  - pide los recibos de los tickets dados a su propio endpoint
  - traduce cada recibo a despachado o no, con su motivo
  - marca para dar de baja el aparato que el recibo reporta desinstalado
  - un ticket cuyo recibo no está listo no aparece
  - ignora recibos de tickets que no se pidieron
  - parte en lotes de 1000
  - un corte de red no inventa recibos ni lanza
  - una respuesta de error de la pasarela no inventa recibos
  - un rechazo de la consulta completa no inventa recibos
  - manda la credencial también al pedir recibos

**`src/auth/dto/auth-dto.spec.ts`** (15)

- acepta un cuerpo completo y válido
- no deja propiedades fantasma en la instancia: solo lo que entró
- acepta un registro sin segundo nombre
- rechaza un apellido ausente: el nombre no puede quedar a medias
- rechaza el antiguo full_name: el nombre llega desglosado
- rechaza dígitos dentro de una parte del nombre
- admite las formas reales de un apellido: tildes, eñe, guion y apóstrofo
- rechaza un cuerpo vacío en lugar de aceptarlo en silencio
- rechaza si falta un campo obligatorio
- rechaza una propiedad desconocida: es la barrera contra escalar privilegios
- rechaza el antiguo id_card_base64, que ya no forma parte del registro
- rechaza una contraseña sin mayúscula, minúscula y dígito
- acepta credenciales válidas
- rechaza una propiedad desconocida
- rechaza un correo mal formado

**`src/avistamientos/avistamientos.controller.spec.ts`** (3)

- «registrarUso» no recibe al usuario: no hay forma de que llegue a la base ni al registro (I2)
- «contacto» no recibe al usuario: no hay forma de que llegue a la base ni al registro (I2)
- la prueba sí detecta un usuario si alguien lo agrega

**`src/common/filters/http-exception.filter.spec.ts`** (6)

- *excepciones de Nest*
  - conserva el código y el mensaje
  - conserva la lista de motivos de una validación
- *errores de middleware de Express*
  - un cuerpo demasiado grande devuelve 413, no 500
  - también funciona si solo trae statusCode
- *lo que sí es un fallo del servidor*
  - un error cualquiera sigue devolviendo 500
  - un error con código 5xx no se convierte en respuesta de cliente

**`src/config/autoridad.config.spec.ts`** (4)

- agrega el código de Bolivia a un celular escrito sin él
- quita espacios, guiones y el «+»
- deja como está un número que ya trae su código de país
- sin valor no hay canal de mensajería

**`src/config/validar-entorno.spec.ts`** (15)

- deja pasar dos secretos largos y distintos
- *número de la autoridad*
  - exige el número al que se llama con un avistamiento
  - fuera de producción no arranca apuntando al 110
  - rechaza cualquier código corto, no solo los de una lista
  - acepta un celular, con o sin código de país
  - en producción acepta el 110
  - la mensajería es opcional, pero si está pasa por la misma regla
  - rechaza lo que no es un número
  - no repite el número en el error: puede ser el celular de alguien
  - sin problemas de secretos, no sugiere generar secretos
- rechaza los valores de ejemplo publicados en el repositorio
- rechaza un secreto que falta o está vacío
- rechaza un secreto de menos de 32 caracteres
- rechaza el mismo valor para los dos secretos
- reúne todos los problemas en un solo error

**`src/declaraciones/domain/cadena.spec.ts`** (18)

- *sellado de un registro*
  - el mismo contenido produce siempre el mismo hash
  - cambiar cualquier campo cambia el hash
  - distingue campos con espacios: el separador no puede ser un espacio
  - detecta un registro alterado tras el sellado
  - rechaza un campo que contenga el separador
- *firma del teléfono (H6.3)*
  - un registro sin firma conserva exactamente su hash de siempre
  - la firma entra en el hash: quitarla o cambiarla después se detecta
- *sellado del contenido de la denuncia*
  - el mismo contenido produce el mismo hash
  - cambiar un campo descriptivo cambia el hash: por eso se cierra la edición
  - la fórmula 1 ignora los campos que no existían cuando se escribió
  - la misma denuncia sellada con fórmulas distintas da hashes distintos
  - una versión de fórmula inexistente falla en vez de sellar cualquier cosa
  - un valor múltiple en distinto orden es el mismo conjunto y debe sellar igual
- *verificación de la cadena*
  - una cadena bien formada se verifica sin errores
  - detecta el registro alterado y señala cuál
  - detecta que se suprimió un registro intermedio
  - detecta un registro insertado al final sin encadenar
  - una cadena vacía es válida: todavía no hay nada que verificar

**`src/declaraciones/domain/firma-dispositivo.spec.ts`** (8)

- arma el mensaje en el formato publicado, idéntico al del teléfono
- cualquier cambio en lo declarado cambia el mensaje
- arma el mensaje en el formato publicado, idéntico al del teléfono
- nunca coincide con el de una declaración: una firma no vale por la otra
- acepta la firma de la clave sobre ese mensaje
- rechaza la firma de otro mensaje y la de otra clave
- lo malformado cuenta como firma inválida, no como error
- cumple el vector 1 de la RFC 8032, el mismo que usa la prueba del teléfono

**`src/denuncias/caducidad.scheduler.spec.ts`** (4)

- caduca las alertas vencidas al ejecutarse
- no registra nada cuando no hay ninguna vencida
- absorbe un fallo de la base sin propagarlo
- deja registro del fallo para poder diagnosticarlo

**`src/denuncias/domain/estados.spec.ts`** (11)

- *nivel de confianza*
  - sube de REGISTRADA a PROVISIONAL al firmar la declaración
  - solo hay dos niveles: firmar es la única subida
  - nunca baja: una declaración firmada no se retira
  - no transiciona a sí mismo
- *estado*
  - una denuncia activa puede caducar, invalidarse o cerrarse
  - una caducada puede reactivarse al prolongarla: caduca la alerta, no el caso
  - una invalidada no se reactiva por ninguna vía
  - una cerrada es terminal
- *difusión*
  - una denuncia REGISTRADA no se difunde, aunque esté activa
  - se difunde una vez firmada
  - ningún nivel se difunde si la denuncia no está activa

**`src/denuncias/domain/minoria-edad.spec.ts`** (12)

- *edadEn*
  - cuenta años cumplidos
  - no cuenta el año en curso si el cumpleaños no llegó
  - cuenta el año el mismo día del cumpleaños
- *esMenorDeEdad*
  - un niño de diez años lo es
  - deja de serlo el día que cumple dieciocho
  - un adulto no lo es
  - se mide contra hoy, no contra cuándo desapareció
  - una fecha ausente no es menor
  - una fecha ilegible no es menor
  - acepta la cadena de la columna `date` y un Date indistintamente
  - no corre la fecha un día por la zona horaria
  - el umbral es el declarado, no un número suelto

**`src/denuncias/domain/zona-avistamiento.spec.ts`** (9)

- reduce un punto preciso a la celda que lo contiene
- el punto guardado queda a menos de un kilómetro del real
- dos puntos de la misma manzana caen en la misma zona
- dos puntos lejanos siguen en zonas distintas
- es idempotente: reducir una zona ya reducida no la mueve
- el mismo punto siempre da el mismo resultado
- funciona en los cuatro cuadrantes del planeta
- no arrastra ruido decimal de coma flotante
- *aCentroDeCelda*
  - devuelve el centro y no la esquina de la celda

**`src/denuncias/dto/prohibiciones.spec.ts`** (23)

- acepta un formulario completo y válido
- los dos campos opcionales lo son de verdad
- *P1 · sin texto libre*
  - rechaza el antiguo campo de relato libre
  - tampoco lo acepta al editar: cerrar una puerta y dejar la otra abierta no cierra nada
  - el único campo de texto libre es el nombre de la persona buscada
  - un valor fuera del dominio se rechaza aunque se parezca al correcto
  - un valor múltiple con un elemento inválido se rechaza entero
- *P3 · ningún dato de un tercero*
  - rechaza el campo «presunto_responsable»
  - rechaza el campo «acompanante»
  - rechaza el campo «vehiculo»
  - rechaza el campo «placa»
  - rechaza el campo «apodo»
  - rechaza el campo «direccion»
  - rechaza el campo «sospechoso»
  - rechaza el campo «ultimo_contacto»
- *P4 · ni recompensa ni contacto*
  - rechaza el campo «recompensa»
  - rechaza el campo «telefono_contacto»
  - rechaza el campo «contacto»
  - rechaza el campo «whatsapp»
- *P5 · sin narrativa de los hechos*
  - la circunstancia es obligatoria y de dominio cerrado
  - rechaza narrar la circunstancia en vez de elegirla
- *fotografía*
  - el DTO acepta que falte: la obligatoriedad depende de la edad
  - lo que sí rechaza es una imagen que no es base64

**`src/denuncias/vista-publica.spec.ts`** (5)

- no expone el identificador de quien denunció
- tampoco al propio autor: no hace falta para nada
- dice si la denuncia es de quien la mira
- conserva todo lo demás, incluida la distancia de la consulta de cercanía
- aplica lo mismo a una lista

**`src/sanciones/domain/situacion.spec.ts`** (13)

- *estadoSancion*
  - sin faltas, la cuenta está normal
  - con una falta, queda con falta
  - la suspensión prevalece sobre el recuento de faltas
- *finDeSuspensionTemporal*
  - dura los días configurados desde la última falta
  - termina sola: pasados los días, ya no hay suspensión
  - sin faltas no hay suspensión
- *funcionesRestringidas*
  - una cuenta normal no tiene restricciones
  - con una falta reciente no denuncia, no firma ni prolonga, pero sigue recibiendo alertas (I9)
  - pasados los días de la falta no pierde nada: la falta solo cuenta para la suspensión
  - suspendida pierde todo, incluso la recepción de alertas
- *debeSuspenderse*
  - una sola persona no alcanza para suspender de forma definitiva (I9)
  - dos personas distintas sí
- *fechaLegible*
  - escribe la fecha en la hora de Bolivia, no en la del servidor

**`src/users/domain/correo.spec.ts`** (7)

- pasa a minúsculas: el teclado del teléfono capitaliza la primera letra
- recorta los espacios que deja el autocompletado
- no toca lo que ya está en forma canónica
- es idempotente: normalizar dos veces da lo mismo
- no altera los espacios internos, que invalidan el correo
- *correoEsCanonico*
  - reconoce la forma canónica
  - rechaza mayúsculas y espacios

**`src/users/domain/estado-cuenta.spec.ts`** (1)

- solo es cierto para SUSPENDIDA

**`src/verification/domain/comparacion-facial.spec.ts`** (10)

- *umbral*
  - acepta una distancia por debajo del umbral
  - acepta exactamente el umbral: es el último valor aceptable
  - rechaza apenas por encima
  - es más estricto que el umbral publicado del modelo
  - deja pasar la peor degradación legítima que se midió
- *mensajes*
  - distingue no encontrar un rostro de que los rostros no coincidan
  - ninguno afirma que la identidad quedó verificada
  - los que piden otra foto dicen cómo mejorarla
- *límites declarados*
  - nombra la ausencia de detección de vivacidad
  - admite que el umbral no está calibrado con datos etiquetados

**`src/verification/domain/nombres.spec.ts`** (14)

- *normalización*
  - ignora mayúsculas, tildes y espacios de más
  - pliega la eñe a n, porque el OCR la confunde y cuesta teclearla
- *partes significativas*
  - descarta preposiciones y artículos, que aparecen en cualquier texto
- *consistencia con el documento*
  - acepta un nombre que aparece completo en el documento
  - tolera que el OCR estropee una palabra suelta
  - rechaza cuando solo coincide una parte del nombre
  - rechaza un nombre sin ninguna relación con el documento
  - con un solo nombre comparable, exige ese
  - rechaza un nombre sin partes comparables
- *firma escrita a mano*
  - acepta el mismo nombre escrito sin tildes
  - acepta mayúsculas y espacios de más
  - rechaza un nombre incompleto: la firma es del nombre entero
  - rechaza el orden alterado: no es el mismo nombre
  - rechaza un campo vacío

### Integración del backend — 273 pruebas en 10 suites

**`src/alertas/alertas.service.int-spec.ts`** (47)

- *dispositivos*
  - una persona puede tener varios dispositivos
  - un token reasignado cambia de dueño en vez de duplicarse
- *a quién alcanza la alerta*
  - alcanza a quien está dentro del radio del caso
  - no alcanza a quien está fuera del radio
  - usa el radio de la denuncia, no una constante del sistema
  - excluye a quien no reporta ubicación desde hace demasiado
  - excluye a quien no tiene ningún dispositivo registrado
  - no alerta a quien denunció: ya conoce el caso
  - alcanza los dos dispositivos de la misma persona
- *procesamiento de la cola*
  - procesa una emisión pendiente y registra a cuántos alcanzó
  - registra una entrega por destinatario con su distancia
  - permite medir la latencia entre encolar y emitir
  - descarta la emisión si la denuncia caducó antes de procesarse
  - descarta la emisión de una alerta vencida aunque el planificador no la haya marcado
  - no vuelve a procesar una emisión ya completada
  - una emisión sin destinatarios se completa igual, sin entregas
- *aparatos desinstalados*
  - da de baja el aparato cuyo token ya no existe
  - la entrega fallida sobrevive a la baja del aparato
  - un fallo que no es de token no da de baja nada
  - quien reinstala vuelve a recibir alertas
- *a escala de ciudad*
  - registra completa una emisión a 20 000 destinatarios
- *fallos a mitad de una emisión*
  - retoma una emisión que quedó «procesando» porque el proceso murió
  - un fallo al cerrar la emisión no vuelve a notificar a nadie
  - si la pasarela cae a mitad, el reintento solo repite el lote sin confirmar
  - retoma una emisión cuyo arrendamiento venció
  - no toma una emisión que otro trabajador está procesando
  - da por fallida una huérfana que ya gastó sus intentos
  - la base rechaza dos entregas de la misma emisión al mismo teléfono
- *recibos de entrega*
  - el envío guarda el ticket de cada entrega aceptada
  - un recibo positivo deja la entrega despachada sin mover la latencia de envío
  - un recibo con error la deja no despachada, con el motivo
  - si el recibo dice que el aparato ya no existe, lo da de baja y conserva la entrega
  - no pregunta antes de la espera que recomienda Expo
  - un recibo que todavía no está listo se vuelve a pedir en el ciclo siguiente
  - pasadas 24 horas sin recibo la da por perdida, sin preguntar
  - lo aceptado sin ticket queda sin recibo de inmediato
  - una entrega ya resuelta no se vuelve a consultar
  - recorre más de una página de recibos en el mismo ciclo
  - la base rechaza un estado de entrega que el código no conoce
- *aviso diferido a la persona reportada (H4.4)*
  - encola el aviso de una denuncia activa que ya identificaba a la persona
  - avisa aunque la denuncia siga en REGISTRADA: el aviso directo no espera a la difusión
  - no encola nada si ninguna denuncia identifica a la persona
  - ignora denuncias ya invalidadas o cerradas: no hay alerta que activar
  - avisa de cada denuncia activa cuando hay varias
  - es idempotente: repetir el registro no duplica avisos
  - no duplica el aviso que H4.1 ya encoló al crear la denuncia
  - el aviso encolado se procesa y alcanza el dispositivo de la persona

**`src/avistamientos/avistamientos.service.int-spec.ts`** (8)

- anota el toque sobre una alerta difundida
- la tabla no tiene dónde guardar a la persona, el lugar ni la hora del avistamiento (I2)
- la hora queda truncada al minuto
- la base rechaza una hora con segundos aunque se escriba directo
- la base rechaza un canal que la app no tiene
- también cuenta sobre una alerta vencida: la persona puede seguir desaparecida
- no anota nada sobre una alerta sin firmar, cerrada o inexistente, y responde igual
- no escribe nada en el registro de la aplicación

**`src/cierres/cierres.service.int-spec.ts`** (46)

- *autorización*
  - permite cerrarla a quien el documento de la denuncia identifica
  - no deja cerrar una denuncia que identifica a otra persona
  - tampoco al propio denunciante: no es una vía para borrar lo que uno firmó
  - devuelve el mismo error para una denuncia ajena que para una inexistente
  - exige documento registrado para poder cerrar
- *los dos tipos de cierre*
  - «Estoy bien» exige decidir si quien denunció podrá volver a hacerlo
  - «Es falsa» siempre bloquea volver a denunciar, aunque se pida lo contrario
  - «Estoy bien» guarda lo que la persona eligió sobre el bloqueo
  - los dos dejan la denuncia INVALIDADA: el tipo solo queda en el cierre
- *atomicidad*
  - revoca las emisiones pendientes en la misma operación
  - no toca las emisiones ya completadas: son el registro de lo que sí salió
  - deja el registro del cierre con ambos hashes y su tipo
  - no borra la denuncia: queda invalidada y sigue siendo consultable (I7)
  - si el registro falla, nada queda a medias: ni invalidada, ni falta, ni bloqueo
- *estados*
  - permite cerrar una denuncia CADUCADA: su autor podría prolongarla
  - rechaza cerrar dos veces la misma denuncia
  - *una que su autor dio por terminada («La encontramos»)*
    - todavía se puede declarar falsa, y deja la falta
    - conserva su estado: ya no se difundía, y CERRADA es terminal
    - admite una sola respuesta
    - aparece en la lista de la persona, que puede responderla una vez
  - INVALIDADA es terminal: la caducidad ya no la alcanza
- *lo que ve la persona reportada*
  - lista las denuncias que la identifican sin revelar quién denunció (I8)
  - no muestra las denuncias que identifican a otras personas
  - incluye las caducadas, que pueden volver a difundirse
  - sigue listándola tras cerrarla, pero ya no como cerrable
  - marca como cerrables las activas y las caducadas
  - el resultado no nombra al denunciante pero sí anuncia la constancia
  - no promete una constancia si nadie llegó a firmar la denuncia
  - le dice a la persona qué consecuencia tuvo lo que eligió
  - sin documento registrado la lista está vacía, no falla
- *faltas y suspensión*
  - un «Es falsa» da una falta y siete días sin denunciar, no la suspensión definitiva (I9)
  - «Estoy bien» no da ninguna falta
  - dos personas distintas que la declaran falsa suspenden y bloquean el documento
  - con la primera falta, sus otras alertas dejan de difundirse en el mismo acto
  - con la suspensión definitiva se detienen también las que había vuelto a difundir
  - la suspensión cuenta personas, no cierres: dos de la misma persona no bastan
  - bloquear el documento es idempotente: una tercera persona no hace fallar el cierre
  - el mismo hecho no produce dos faltas
  - el estado guardado coincide con el que se deriva de los cierres (I12)
  - la situación propia no revela la denuncia ni a la persona que la cerró
- *solo inserción (I11)*
  - un cierre no se puede modificar ni borrar
  - una falta no se puede modificar ni borrar
- *restricciones de la base*
  - una denuncia no admite dos cierres
  - rechaza un «Es falsa» que no bloquee volver a denunciar
  - rechaza dos denuncias abiertas del mismo denunciante sobre la misma persona
  - impide marcar un documento como registrado sin su hash

**`src/constancias/constancias.service.int-spec.ts`** (24)

- *autorización*
  - la persona reportada recibe la identidad de quien la denunció
  - quien firmó accede solo a su propia declaración
  - a un tercero le responde como si la denuncia no existiera
  - exige documento registrado para pedirla
- *contenido*
  - la persona reportada ve también a quienes corroboraron
  - conserva literal la frase escrita al firmar
  - declara si la declaración lleva firma criptográfica
  - no entrega constancia de una denuncia que nadie firmó
- *documento autoverificable*
  - publica el procedimiento y el orden de los campos
  - el hash del registro se recalcula desde los campos publicados
  - el hash del contenido se recalcula desde la denuncia publicada
  - incluye el texto legal entero, no una referencia
  - altera un campo y el hash deja de cuadrar
  - las coordenadas viajan en la forma exacta que se selló
  - declara con franqueza lo que no demuestra
  - *con la firma del teléfono (H6.3)*
    - publica la clave pública misma, no solo su identificador
    - la firma se verifica con lo publicado, sin preguntarle nada al sistema
    - el hash del registro suma la clave y la firma al final
    - el verificador publicado la acepta, acepta una sin firma y rechaza una alterada
    - una firma alterada en el documento ya no se verifica
- *auditoría y disponibilidad*
  - registra cada solicitud con quién, qué y con qué alcance
  - puede pedirse varias veces, y cada entrega queda registrada
  - sigue disponible después de retirar la alerta
  - un rechazo no deja rastro de entrega

**`src/declaraciones/declaraciones.service.int-spec.ts`** (7)

- la migración deja vigente el texto sin la FELCC
- el texto vigente nombra el vínculo una vez, con el marcador que la app reemplaza por el elegido
- las versiones anteriores se conservan intactas y ya no vigentes: hay declaraciones firmadas contra ellas
- el hash corresponde al texto, para poder verificarlo años después
- detecta que el texto fue alterado sin actualizar su hash
- impide que dos versiones estén vigentes a la vez
- permite conservar versiones anteriores no vigentes

**`src/declaraciones/firmas.service.int-spec.ts`** (48)

- *la firma difunde la denuncia*
  - al firmar, la denuncia pasa a PROVISIONAL con radio y caducidad
  - un tercero no familiar entra con menos alcance y menos plazo, no rechazado
  - guarda literal lo que la persona escribió
- *comprobación del nombre escrito*
  - acepta el nombre sin tildes y con mayúsculas distintas
  - rechaza un nombre incompleto: se firma con el nombre entero
  - rechaza a quien no tiene documento registrado
  - impide firmar la denuncia de otra persona
  - no permite firmar dos veces la misma denuncia
- *paquete probatorio*
  - sella la versión del texto legal que se mostró, no «la vigente»
  - la marca temporal la pone el servidor
  - encadena los registros: el segundo apunta al hash del primero
  - la cadena almacenada se verifica sin errores
  - sella el contenido de la denuncia en ese instante
- *append-only del paquete probatorio*
  - rechaza modificar una declaración ya firmada
  - rechaza modificar el hash para encubrir una alteración
  - rechaza eliminar una declaración
  - impide borrar la denuncia para arrastrar su declaración
  - la declaración sigue ahí tras los intentos fallidos
  - sí permite insertar: corregir es firmar de nuevo, no editar
- *verificación de la cadena completa*
  - una cadena recién construida está intacta
  - una cadena vacía está intacta: todavía no hay nada que verificar
- *firma del teléfono*
  - sella la firma y la clave con la declaración, y la cadena las cubre
  - rechaza una firma que no corresponde a lo declarado, y no sella nada
  - rechaza la clave de otra cuenta, aunque la firma sea válida para esa clave
  - si la denuncia cambia después de firmarse en el teléfono, la firma ya no vale
  - el hash que entrega para firmar es el mismo que queda sellado
  - el hash para firmar solo se entrega al autor, y mientras se pueda firmar
  - registrar la clave es idempotente para su dueño; la misma clave en otra cuenta se rechaza
  - una clave registrada no se puede modificar ni borrar: sus firmas dejarían de verificarse
  - la base solo acepta claves de 32 bytes en hexadecimal
- *régimen de faltas al firmar*
  - durante los días de una falta no firma: el rechazo trae su código y no sella nada
  - pasados los días de la falta, firma y difunde con el alcance de siempre (I9)
  - una cuenta suspendida no firma
  - no difunde una tercera alerta a la vez
  - las vencidas no cuentan para el límite
  - no se firma una sin firmar que su autor ya cerró
- *prolongar la alerta*
  - la mantiene a la vista otro plazo, contado desde ahora, sin notificar a nadie
  - devuelve a la vista una alerta ya vencida
  - al devolver a la vista una vencida no suelta la notificación que no alcanzó a salir
  - un tercero no familiar prolonga con su plazo, más corto
  - tiene un tope: la cuarta se rechaza
  - queda firmada, y la firma de una prolongación no sirve para la siguiente
  - una firma sobre otra cosa se rechaza y no prolonga nada
  - solo quien la presentó puede prolongarla
  - no se prolonga una sin firmar, una cerrada por la persona ni una que su autor dio por terminada
  - durante los días de una falta no se prolonga
  - devolver a la vista una vencida cuenta para el límite de alertas
  - una prolongación no se puede modificar ni borrar: es una firma

**`src/denuncias/denuncias.service.int-spec.ts`** (68)

- *creación*
  - nace REGISTRADA, sin radio ni caducidad: existe pero no se difunde
  - rechaza a quien no tiene documento registrado
  - guarda el documento de la persona buscada solo como hash
  - no devuelve el hash del documento en la entidad
  - P6 · el documento no queda en claro en ninguna columna ni en los registros
  - rechaza un último avistamiento en el futuro
  - guarda los valores múltiples ordenados y sin repetidos
  - la base rechaza un valor fuera del dominio aunque se escriba directo
  - la base impide nacer después de haber sido visto por última vez
  - se sella con la fórmula que no incluye el relato libre
  - Postgres calcula la ubicación geográfica a partir de las coordenadas
  - P·ubicación · no guarda el punto exacto que se envió
  - P·ubicación · dos denuncias de la misma manzana quedan en la misma zona
- *régimen de sanciones al denunciar*
  - una cuenta suspendida no denuncia, y el rechazo trae su código
  - con una falta reciente no denuncia por unos días, y el rechazo dice hasta cuándo
  - pasados los días de la falta vuelve a denunciar: una falta sola nunca suspende para siempre (I9)
  - no admite una segunda denuncia abierta sobre la misma persona
  - una caducada sigue abierta: tampoco admite otra encima
  - la regla es de cada denunciante: otra persona sí puede denunciar a la misma
  - cerrada con «Estoy bien» sin bloqueo, se puede volver a denunciar
  - el bloqueo no revela qué cierre eligió la persona
  - dos envíos simultáneos: uno se registra y el otro recibe el 409
- *«La encontramos»*
  - quien la presentó la da por terminada: deja de difundirse y queda la fecha
  - revoca lo que todavía no salió
  - nadie más puede hacerlo, y para los demás es como si no existiera
  - no se puede cerrar dos veces ni reabrir
  - no pisa el cierre de la persona reportada
  - también una vencida
  - una sin firmar también, y libera para volver a denunciar si vuelve a desaparecer
  - la base exige la fecha en una cerrada, y solo en ella
- *quién ve el detalle*
  - quien la presentó la ve siempre, aunque nadie más pueda
  - una sin firmar solo la ve su autor
  - una difundida la ve cualquiera
  - una vencida se sigue viendo desde la notificación que ya se recibió
  - una que la persona reportada cerró ya no la ven los vecinos
  - una oculta responde igual que una que no existe
- *difusión*
  - una denuncia REGISTRADA no aparece en la consulta de cercanía
  - una denuncia difundida y vigente sí aparece, con su distancia
  - no aparece si está fuera del radio consultado
  - una alerta vencida no se difunde aunque su estado siga ACTIVA
  - su autor sigue viéndola aunque no se difunda
- *caducidad*
  - marca las vencidas y conserva hasta dónde y hasta cuándo se difundieron
  - no toca las que siguen vigentes
  - no toca una REGISTRADA, que nunca llegó a difundirse
- *edición*
  - permite corregir mientras la denuncia siga REGISTRADA
  - cierra la edición una vez declarada bajo juramento
  - una cerrada ya no se edita, aunque nadie la haya firmado
  - impide editar la denuncia de otra persona
- *fotografías*
  - guarda la fotografía en su propia tabla, no en la fila de la denuncia
  - la consulta de cercanía no arrastra el contenido de las imágenes
  - «mis denuncias» tampoco arrastra el contenido
  - reemplaza la imagen al editar, sin dejar la anterior huérfana
  - *menores de edad*
    - rechaza la denuncia de un menor que trae fotografía
    - acepta la denuncia de un menor sin fotografía
    - sigue exigiendo fotografía a quien no es menor
    - corregir la fecha a la de un menor retira la fotografía ya guardada
    - no deja adjuntar una fotografía a una denuncia ya marcada como de menor
    - corregir la fecha a la de un adulto vuelve a permitir fotografía
  - borrar la denuncia se lleva sus fotografías
- *restricciones de la base*
  - rechaza una denuncia difundible sin plazo de caducidad
  - rechaza un nivel de confianza que el código no sabe interpretar
  - rechaza un estado que el código no sabe interpretar
- *aviso por coincidencia de documento*
  - encola un aviso directo cuando la persona reportada tiene cuenta
  - no encola nada si la persona reportada no tiene cuenta
  - avisa al crear, sin esperar a que la denuncia se difunda
  - la respuesta es indistinguible haya coincidencia o no
  - la columna geográfica generada no viaja en la respuesta
  - el hash del documento reportado tampoco viaja en la respuesta

**`src/users/users.service.int-spec.ts`** (10)

- *composición del nombre*
  - compone el nombre completo a partir de las cuatro partes
  - sin segundo nombre no deja un espacio de más en el nombre completo
  - guarda las partes además del nombre compuesto
  - la base rechaza una cuenta con el nombre a medias
  - admite cuentas anteriores al desglose, que solo tienen nombre suelto
- *registro de documento*
  - una cuenta nueva no tiene documento registrado ni nombre asociado
  - al registrar el documento guarda el nombre, que es la referencia de la firma
  - registrar el documento no cambia el nombre de la cuenta
  - el documento se guarda solo como hash, nunca en claro
  - un mismo documento no puede registrarse en dos cuentas

**`src/verification/documento/lector-tesseract.int-spec.ts`** (7)

- lee el número de documento
- lee el apellido
- devuelve el texto crudo, sin interpretarlo
- una imagen ilegible es error del cliente, no del servidor
- sigue leyendo después de una imagen ilegible
- reutiliza el trabajador entre lecturas
- dos lecturas simultáneas no se pisan

**`src/verification/rostros/comparador-face-api.int-spec.ts`** (8)

- reconoce el mismo rostro pese a la degradación de un carnet
- rechaza a otra persona
- deja margen entre el caso legítimo y el ajeno
- dice que no hay rostro en el documento cuando no lo hay
- distingue que el rostro ausente es el de la selfie
- dos comparaciones simultáneas no se pisan
- no congela el servidor mientras compara
- si el hilo muere a mitad, esa comparación falla y la siguiente funciona

### Móvil — 34 pruebas en 6 suites

**`src/components/mapa/clave-de-google.spec.ts`** (6)

- con la variable, la clave va al manifiesto y el APK dice que puede usar Google
- sin la variable no se escribe clave y el APK usa el mapa de respaldo
- conserva lo que viene de app.json
- el indicador de septiembre no cuenta: esos APK traen una clave de relleno
- ante una configuración ilegible o ausente, responde que no
- también la lee si llega como objeto

**`src/services/restricciones.spec.ts`** (4)

- con código, titula según la restricción y respeta el mensaje del servidor
- un código que la app no conoce no se trata como restricción
- une los mensajes de validación, que llegan como lista
- sin respuesta del servidor usa el texto por defecto

**`src/services/ubicacion.spec.ts`** (3)

- al entrar pide el permiso e informa la posición
- al volver al primer plano no abre ninguna pantalla del sistema
- sin permiso no busca la posición ni informa nada

**`src/utils/mensaje-de-firma.spec.ts`** (4)

- arma exactamente el mismo mensaje que el servidor
- arma exactamente el mismo mensaje que el servidor
- cumple el vector 1 de la RFC 8032, el mismo que verifica el servidor
- firma los bytes UTF-8 del mensaje: las tildes cuentan

**`src/utils/reporte-avistamiento.spec.ts`** (12)

- convierte cada franja en horas del reloj
- la última franja no tiene comienzo: puede ser ayer
- pone las dos fechas cuando el rango cruza la medianoche
- un rango entero de ayer lleva la fecha de ayer
- las franjas no dejan huecos ni se pisan
- arma el texto que se lee o se envía
- no lleva el CI: quien recibe la alerta no lo tiene
- no lleva el número de caso de la FELCC: no es público
- sin calle, la zona es solo el enlace del mapa
- el mapa lleva el punto con cinco decimales, un metro de precisión
- la llamada va sin espacios ni guiones
- WhatsApp recibe el número en dígitos y el texto codificado

**`src/utils/texto-legal.spec.ts`** (5)

- escribe el vínculo elegido en lugar del marcador
- lo reemplaza todas las veces que aparezca
- un texto sin marcador queda igual
- parte el texto donde va el vínculo, para poder resaltarlo
- pone la primera letra en mayúscula para mostrar la etiqueta sola
