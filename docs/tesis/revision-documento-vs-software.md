# Revisión del documento frente al software

**Qué se comparó:** `Diego_Revision.pdf` (102 páginas) contra el código de la rama `Fix/Reportes`
(commit `6df1f87`), el servidor de la beta y la base local. Los datos del servidor se leyeron con
consultas de solo lectura, y solo agregados.
**Fecha:** 3 de noviembre de 2026.

Las páginas que se citan son las del PDF. Cada punto dice qué dice el documento, qué hace el
software y una redacción propuesta.

## Resumen

**Corregir antes de entregar.** Cambian el sentido de lo que se afirma:

| # | Dónde | El problema |
|---|---|---|
| A1 | 1.4, 4.2.3 | Dice que nada funciona sin documento registrado. En el software, cualquier cuenta recibe alertas y reporta avistamientos |
| A2 | T13, 4.2.2, 4.2.3 | Dice «persona sosteniendo el documento». Es una selfie sin el documento |
| A3 | 4.1.2, 4.4.3, 4.4.4 | Describe tres procesos. Es uno solo, con tres tareas periódicas |
| A4 | 4.1.3 | Dice que ningún módulo accede al repositorio de otro. Varios lo hacen |
| A5 | 4.4.3 | Ubica el aviso a la persona reportada en la emisión. Sale al crear la denuncia |
| A6 | Justificación, 4.4.1, 4.5.1 | Dice que quien está fuera no ve el caso y que solo quien está dentro reporta avistamientos. Ninguna de las dos cosas es así |
| A7 | 4.5.1 | Dice que el número de la autoridad es el 110. En el prototipo es un celular de prueba |
| A8 | 4.6.1, 4.6.4 | Habla de un entorno aislado. Las pruebas son en el servidor de la beta |
| A9 | Tabla 21, Resumen, Conclusiones | La prueba de campo del 21/10 no tiene registros en ningún servidor |
| A10 | 4.6.3, 4.6.4 | Cita las versiones 1.4.1, 1.4.2 y 1.4.3. La app siempre fue la 1.0.0 |

**Datos desactualizados o imprecisos:**

- A11 a A21: cifras de la base y de las pruebas, entidades, servicios de terceros, la tarea T30,
  el radio en el marco teórico y la intervención manual del operador.
- Sección B: datos para completar los marcadores.
- Sección C: precisiones menores.

---

## A. Lo que contradice el software

### A1. El uso sin documento registrado

**Páginas 22 (1.4, primer punto) y 62 (4.2.3).**

**Dice:**

> «El sistema habilitará su uso únicamente a usuarios con documento de identidad registrado»

y

> «ninguna funcionalidad del sistema resulta accesible sin una cuenta vinculada a un
> documento».

**El software:**

- Cualquier cuenta con la sesión iniciada entra a la app. Lo dice el comentario de
  `apps/mobile/App.tsx`: «cualquier usuario logueado entra».
- Esa cuenta puede:
  - ver el mapa y la lista de alertas;
  - **recibir alertas**: la consulta de destinatarios no mira el documento
    (`apps/backend/src/alertas/alertas.service.ts:198`);
  - **reportar avistamientos**.
- En el perfil aparece como «Visitante».
- El documento se exige solo para dos acciones:
  - **denunciar** (`MapScreen.native.tsx`, `handleReport`);
  - **firmar** (`FirmarDeclaracion` y `firmas.service.ts`, `validarFirmante`).

**Propuesta para 1.4:**

> «El registro de denuncias y la firma de declaraciones juradas exigirán un documento de
> identidad registrado, de modo que cada denuncia quede asociada a un número de documento único
> y no reutilizable. Cualquier cuenta, aun sin documento registrado, puede recibir alertas y
> reportar avistamientos.»

**Propuesta para 4.2.3:**

> «La separación refleja que el documento se exige solo para las acciones que difunden
> información: registrar una denuncia y firmar su declaración.»

Si la Figura 5 (casos de uso) no muestra a la cuenta sin documento, conviene agregarla.

### A2. Una selfie, no «la persona sosteniendo el documento»

**Páginas 47 (T13), 60 (4.2.2) y 62 (4.2.3).**

**El software:** `SelfieScreen` usa la cámara frontal, con las indicaciones «Mira directamente a
la cámara» y «No uses gafas ni cubras tu rostro». El servidor compara ese rostro con el impreso
en el anverso. El documento no aparece en la selfie.

Lo que sí es correcto: las dos fotos se toman solo con la cámara, sin galería.

**Propuesta para 4.2.2:**

> «En el tercero se captura una fotografía del rostro con la cámara frontal, que se compara con
> el rostro impreso en el anverso del documento.»

**Propuesta para T13:** «Captura de la fotografía del rostro del titular».

### A3. Un solo proceso, con tres tareas periódicas

**Páginas 53 (4.1.2), 70 (4.4.3) y 71 (4.4.4).**

**Dice:**

- «tres puntos de entrada»;
- «el proceso de trabajadores» y «el proceso planificador»;
- «un proceso independiente del que atiende las peticiones»;
- «un segundo proceso consulta periódicamente los recibos».

**El software:**

- `main.ts` levanta **una sola** aplicación.
- La emisión, los recibos y la caducidad se registran como tareas periódicas
  (`setInterval`) dentro de ese mismo proceso:

  | Tarea | Cada cuánto corre |
  |---|---|
  | Emisión (`EmisionWorker`) | 1 minuto |
  | Recibos (`RecibosWorker`) | 5 minutos |
  | Caducidad (`CaducidadScheduler`) | 5 minutos |

- En el servidor hay un único contenedor del backend.
- Los únicos puntos de entrada aparte son los dos comandos de operación
  (`cli/alerta-de-muestra.ts` y `cli/eliminar-cuenta.ts`).
- La cola con `SKIP LOCKED` y arrendamiento permitiría varias instancias, pero se despliega una.

**Propuesta para 4.1.2:**

> «El servidor de aplicaciones ejecuta un único proceso Node.js que atiende las peticiones del
> cliente y, fuera del ciclo de cada petición, tres tareas periódicas:
>
> - la emisión de las alertas pendientes, cada minuto;
> - la consulta de los recibos de entrega, cada cinco minutos;
> - la caducidad de las alertas, cada cinco minutos.
>
> La cola de emisión, con bloqueo de filas y arrendamiento, admitiría repartir el trabajo entre
> varios procesos, pero el prototipo se despliega con uno.»

En 4.4.3 y 4.4.4, «proceso» pasa a ser «tarea periódica». Hay que agregar que la emisión espera
hasta un minuto (ver A20).

### A4. Los módulos sí usan entidades de otros

**Página 55 (4.1.3).**

**Dice:** «ninguno accede al repositorio de otro».

**El software:** varios servicios leen o escriben entidades de otros módulos:

| Módulo | Entidades de otros módulos que usa |
|---|---|
| `declaraciones` (la firma) | Actualiza `Denuncia` y encola `EmisionAlerta` en la misma transacción |
| `sanciones` | `Denuncia`, `Cierre`, `User` |
| `cierres` | `Denuncia`, `User` |
| `constancias` | `DeclaracionJurada`, `ClaveDispositivo`, `VersionTextoLegal`, `Denuncia`, `User` |
| `users` | `Dispositivo`, `DeclaracionJurada` |
| `verification` | `DocumentoBloqueado` |

Es deliberado: la firma y el encolado tienen que ser una sola transacción.

**Propuesta:**

> «Cada módulo declara de forma explícita sus dependencias. Cuando una operación debe ser
> atómica, como la firma, que actualiza la denuncia y encola su emisión, el servicio opera sobre
> las entidades de otros módulos dentro de la misma transacción.»

**En la lista de módulos:**

- agregar las páginas legales (`legal`), el estado del servidor (`salud`) y la alerta de muestra
  (`muestra`);
- la ficha pública forma parte del módulo de denuncias, no es un módulo aparte.

### A5. El aviso a la persona reportada sale al crear la denuncia

**Página 70 (4.4.3).**

**Dice:** que la emisión, después de la firma, «avisa de forma directa a la cuenta cuyo documento
coincide».

**El software:** el aviso directo se encola **en la misma transacción que crea la denuncia**, antes
de que se firme (`denuncias.service.ts`, `encolarAvisoDirecto`). También sale si la persona
registra su documento después (`alertas.service.ts`, `avisarPersonaReportada`). La app lo advierte al confirmar la
denuncia: «recibirá un aviso de inmediato».

**Propuesta:** quitar esa frase de 4.4.3 y llevarla a 4.3.1:

> «Si el documento de la persona reportada coincide con el de una cuenta, en la misma
> transacción que registra la denuncia se encola un aviso directo a esa cuenta, aunque la
> denuncia todavía no se haya firmado. El aviso se envía también si la persona registra su
> documento más tarde.»

### A6. Quién ve una alerta y quién puede reportar un avistamiento

**Páginas 25 (Justificación), 68 (4.4.1, Figuras 10 y 11) y 73 (4.5.1).**

**Dice:**

- que la segmentación «garantiza que cada alerta llegue exclusivamente» a quienes están dentro;
- que la cuenta de fuera «no recibe el caso ni lo encuentra al consultar sus alertas»;
- que el avistamiento «solo pueden emitirlo los usuarios comprendidos en el área de difusión».

**El software:** solo la **notificación** está segmentada.

| Dónde | Qué muestra |
|---|---|
| Pestaña «Lista de denuncias», orden **Recientes** (el que viene por defecto) | Las 50 alertas difundidas más recientes de todo el sistema, sin filtro de ubicación (`GET /denuncias`, `findRecent`) |
| La misma lista, orden **Cercanía** | Las que están a 100 km o menos |
| Mapa | Las que están a 10 km o menos de la persona |
| Ficha pública (`/fichas/:id`) | Cualquier caso, sin iniciar sesión |

«Vi a esta persona» aparece en el detalle para cualquier cuenta que no sea la autora, mientras
la alerta siga abierta (`DenunciaDetailScreen`, `admiteAvistamiento`). Ni la app ni el servidor
miran el área.

**Recomendación:** corregir el texto en vez del código.

- La ficha es pública a propósito.
- Restringir el avistamiento al área impediría reportar a quien vio a la persona fuera de ella.

**Propuesta para 4.5.1:**

> «El reporte se inicia desde el detalle de una alerta, mediante la opción "Vi a esta persona",
> disponible para cualquier cuenta distinta de la que presentó la denuncia mientras la alerta
> siga abierta. La notificación llega solo a quienes están dentro del radio, pero el caso puede
> consultarse desde la lista, el mapa o la ficha pública, de modo que también puede reportar
> quien vio a la persona fuera del área.»

**Propuesta para la Figura 11:** «una cuenta situada fuera del área, que no recibe la
notificación».

**Propuesta para la Justificación:** «garantiza que la notificación de cada alerta llegue solo a
los usuarios ubicados dentro del radio vigente».

### A7. El número de la autoridad

**Página 73 (final de 4.5.1).**

**Dice:** «El número de la autoridad corresponde a la línea de emergencia policial 110».

**El software:**

- Es un parámetro del servidor (`AUTORIDAD_TELEFONO`).
- En el prototipo desplegado, el de la prueba cerrada de Google Play, apunta a un celular de
  prueba. Se comprobó sin ver el número.
- Ojo: el servidor corre en modo producción, así que ahí no aplica el control que impide el 110
  fuera de producción.

**Propuesta:**

> «El número de la autoridad es un parámetro de la configuración del servidor. En una puesta en
> producción correspondería a la línea de emergencia policial 110; en el prototipo desplegado
> apunta a un teléfono de prueba, para que ningún reporte llegue a la línea real.»

### A8. El entorno no es aislado

**Páginas 77 (4.6.1) y 85 (4.6.4).**

**Dice:** «un entorno de servidor aislado, en el que únicamente se encuentran registradas las
cuentas de los participantes».

**El servidor:**

- Las pruebas en teléfonos usan el servidor de la beta (`alertatemprana.download`), el mismo de
  la prueba cerrada, donde hay otras cuentas.
- La guía de la prueba de campo lo compensa: antes de cada firma comprueba que ninguna otra
  cuenta quede al alcance (`tools/campo/antes.sql`).

**Propuesta:**

> «Las pruebas en dispositivos se ejecutan sobre el servidor de la prueba cerrada de Google Play,
> con cuentas creadas para la prueba. Como en ese servidor existen otras cuentas, antes de cada
> emisión se comprueba que ninguna quede dentro del radio con una ubicación reciente, de forma
> que ninguna alerta de prueba alcance a terceros.»

Si las pruebas de usabilidad se hicieron en otro entorno (la Mac en red local, por ejemplo),
conviene decirlo aparte.

**El rótulo de simulacro.** El documento dice que la alerta se identifica «como simulacro tanto en
su título como sobre la fotografía». La app no agrega nada sobre la foto: el rótulo va en el
nombre de la persona. Hay dos opciones:

- dar la foto ya rotulada;
- usar la silueta «EJEMPLO» de `deploy/muestra/persona-de-ejemplo.jpg`.

### A9. La prueba de campo no tiene registros

**Páginas 5 y 6 (Resumen y Abstract), 85 (Tabla 21) y 87 (Conclusiones).**

**Dice:** que en las emisiones del 21/10 a las 22:32, 22:53 y 23:13, la alerta llegó a 2 de 2
teléfonos dentro y a ninguno de los 2 de fuera.

**Lo que hay en las bases:**

| Base | Qué hay |
|---|---|
| Servidor de la beta | Existe desde el 26/10. No tiene ninguna emisión del 21/10 |
| Base local de la Mac | No tiene ninguna emisión desde el 15/10 |
| Servidor de la beta, 28/10 | La alerta de muestra para la revisión de Play, en el Salar de Uyuni, con 0 destinatarios |
| Servidor de la beta, 03/11 entre las 00:00 y las 00:38 | Cuatro emisiones firmadas por la cuenta de revisión. Solo la última llegó a una cuenta de campo (`campo1`, 1 destinatario) |

Con eso, la Tabla 21 y las frases del Resumen, el Abstract y las Conclusiones no tienen datos
que las respalden. Hay dos caminos:

- Hacer la prueba con `tools/campo/guia-prueba-de-campo.md` y llenar la Tabla 21 y el Anexo 11
  con `campo.sql` y la planilla.
- Si se hizo en otro entorno, decirme cuál para sacar los datos de ahí.

### A10. Las versiones 1.4.1, 1.4.2 y 1.4.3 no existen

**Páginas 83, 84 y 85.**

**El software:** la versión de la app es **1.0.0** en todas las compilaciones. Lo que cambia es el
número de compilación (`versionCode`):

| Fecha | Perfil | versionCode | Commit | Qué trajo |
|---|---|---|---|---|
| 24/09 y 04/10 | desarrollo | 1 | `129fdcd`, `4f1514a`, `9e90843` | Builds de desarrollo |
| 26/10 y 27/10 | preview | 1 | `2ad51eb`, `c6889a4` | APK de la beta |
| 27/10 | producción | 2 | `ffcd951` | Primera de Google Play |
| 29/10 | producción | 3 | `7789239` | Arreglo de la contraseña débil (U-01) y del teclado |
| 02/11 | producción | 4 | `02dfe46` | Reporte como imagen y código de caso |
| 03/11 | producción | 5 | `6df1f87` | Barra de navegación de Android |

Las sesiones de usabilidad del 12 al 15/10 solo pudieron hacerse con el build de desarrollo del
04/10, o con Metro. La corrección de U-01 está en la compilación 3, del 29/10.

**Propuesta:** citar «la compilación 3, del 29/10/2026», y así con las demás. La otra opción es
numerar la versión en `app.json` desde ahora; eso cambia el código y lo decides tú.

### A11. La suspensión definitiva no quita todas las funciones

**Página 63, Tabla 11.**

**Dice:** «Todas las funciones, incluida la recepción de alertas».

**El software:**

- **Conserva:**
  - iniciar sesión (`auth.service` no la bloquea);
  - ver las alertas;
  - reportar avistamientos (I10).
- **Pierde:**
  - registrar denuncias, firmar y prolongar;
  - recibir notificaciones.
- **Además:** el documento queda bloqueado.

El propio texto, justo después de la tabla, dice que el avistamiento no se restringe nunca.

**Propuesta para la celda:**

> «Registrar denuncias, firmar declaraciones, prolongar alertas y recibir alertas. El documento
> queda bloqueado para un nuevo registro. El reporte de avistamientos sigue disponible.»

### A12. Las cifras de la base de datos

**Página 77 (4.6.2).**

**Dice:** «treinta y tres restricciones de verificación y trece índices únicos».

**Contado el 03/11 en el esquema migrado:**

| Elemento | Cantidad |
|---|---|
| Restricciones `CHECK` | **35** |
| Índices únicos (sin contar las claves primarias) | **15** |
| Disparadores | 7 |
| Tablas | 18 |

### A13. Hay más de un doble en las pruebas

**Páginas 77 y 78 (4.6.2).**

**Dice:** «La única dependencia reemplazada por un doble es la pasarela de notificaciones».

**El software:** en las suites de integración de los servicios hay tres dobles:

- la pasarela (`PasarelaPushSimulada`);
- el lector de documento (`LectorDeDocumentoSimulado`);
- el comparador facial (`ComparadorDeRostrosSimulado`).

Los motores reales de OCR y de comparación facial se prueban en sus propias suites: 8 y 8 pruebas.

**Propuesta:**

> «En las pruebas de los servicios se reemplazan por dobles la pasarela de notificaciones, el
> lector del documento y el comparador facial. Los dos últimos se prueban además con sus motores
> reales, en suites propias, sobre un carnet sintético y sobre fotografías de muestra de la
> biblioteca.»

### A14. Los totales de las pruebas

**Páginas 5, 6, 78 (Tabla 14) y 87.**

**Dice:** 629 pruebas en 53 suites.

**El software:** el 03/11 se agregaron 3 pruebas en la app. Son las del margen de la barra de
Android.

| Conjunto | Suites | Pruebas | Duración |
|---|---|---|---|
| Unitarias del servidor | 28 | 263 | 6,5 s |
| Integración del servidor | 14 | 310 | 41,2 s |
| App móvil | **12** | **59** | **5,4 s** |
| **Total** | **54** | **632** | **53,1 s** |

- Las del servidor no cambiaron desde el 02/11.
- La cobertura del servidor (Tabla 15) sigue igual.
- Si prefieres no tocar la cifra, deja 629 y aclara que es la ejecución del 02/11.

### A15. Faltan entidades en la Tabla 9

**Página 56.**

**El software:** hay 18 tablas. A la Tabla 9 le faltan 4:

| Tabla | Qué guarda |
|---|---|
| `claves_dispositivo` | Las claves públicas Ed25519 de cada teléfono, de solo inserción. Sin ellas no se entiende la firma |
| `usos_canal_avistamiento` | El uso del canal de avistamiento |
| `reportes_contenido` | Los reportes de contenido inapropiado |
| `ocultamientos_contenido` | Lo que el operador ocultó tras un reporte |

**Además:** «todas las entidades dependen de la cuenta o de la denuncia» tiene una excepción:
`versiones_texto_legal`.

### A16. Servicios de terceros y forma de distribución

**Páginas 53 y 54 (4.1.2).**

- **Falta Google Maps.** El mapa de la app en Android usa el SDK de Google Maps, con su clave en
  EAS.
- **El correo no está configurado.** El documento dice que se avisa al operador por correo de los
  reportes de contenido. El servidor no tiene SMTP, así que el aviso solo queda en el registro.
  Hay dos opciones: configurar el SMTP o decir que el operador revisa el registro.
- **La distribución es por Google Play.** La app no se distribuye solo como «paquete instalable»:
  va por Google Play, en prueba interna y cerrada. Es un archivo AAB, el formato que exige
  Google Play. El APK se usó en la beta.

### A17. La tarea T30 figura como hecha

**Páginas 48 y 49 (Tablas 4 y 5).**

**Dice:** «T30 Ampliación del radio ante la corroboración del caso», en la iteración 6.

**El historial de git:**

- Se implementó: la ampliación de 10 km existió del 01/09 al 04/10.
- **Se retiró** el 04/10 (migración `SinFelccYProlongaciones`).

El apartado 4.4.2 ya lo cuenta, pero las tablas la siguen dando por vigente.

**Propuesta:** marcarla «implementada y retirada (04/10/2026)», con una referencia a 4.4.2.

### A18. El radio en el marco teórico

**Página 31 (final de 2.1.4).**

**Dice:** «el radio de cobertura no constituye una constante del sistema, sino una magnitud
dependiente del tiempo transcurrido».

**El software:** el radio es fijo según el vínculo, como explica bien el 4.4.2. Las dos partes se
contradicen.

**Propuesta:**

> «…el radio ideal no sería una constante, sino una magnitud dependiente del tiempo transcurrido
> y de las características de la persona buscada. El apartado 4.4.2 explica por qué el
> prototipo adopta un valor fijo.»

### A19. «La encontramos» no revoca los envíos

**Página 72 (4.4.4).**

**Dice:** «La encontramos» «revoca los envíos pendientes».

**El software:**

- **Revocan:** la prolongación y el cierre por la persona reportada.
- **«La encontramos» no revoca.** La emisión pendiente se **descarta** al procesarse, porque la
  alerta ya no está activa (`alertas.service.ts`). El efecto es el mismo, pero el mecanismo es
  otro.

**Propuesta:**

> «…detiene la difusión: una emisión que todavía no salió se descarta al procesarse.»

### A20. Distancias y latencias en la prueba de campo

**Página 85 (4.6.4).**

- **El centro de la zona.** Dice «dos a menos de 1 km de ese punto». Las distancias se miden
  desde el **centro de la zona** (la celda de 0,01°), no desde el punto marcado.
- **El error de la rejilla.** Dice que los márgenes superan el error de la zona de 1 km. El
  centro queda a 0,77 km como mucho del punto marcado, y las posiciones se eligen respecto del
  centro. Lo que cubren los márgenes es el error del GPS de los teléfonos.
- **La latencia percibida no se puede sacar de la hora visible.** Android muestra la hora sin
  segundos. Se mide con cronómetro, desde el «ya» de la firma.
- **La latencia del servidor espera al trabajador.** La emisión espera hasta 60 s a que corra la
  tarea, que revisa cada minuto. En el servidor, esa tarea corre hacia el segundo 15 de cada
  minuto. Las cuatro firmas del 03/11 cayeron justo antes y por eso dieron 3 a 7 s.
- **Firmar en momentos al azar.** En la prueba hay que firmar en momentos al azar, o informar las
  dos componentes: la espera de la tarea y la entrega.

### A21. Sí hay una intervención manual: ocultar contenido reportado

**Páginas 22 (1.4, «sin intervención de moderadores») y 55 (4.1.3, «no contempla un cliente
administrativo»).**

Las dos frases son ciertas para las sanciones. Pero el documento no cuenta la única intervención
manual del sistema, que Google Play exige para el contenido que publican los usuarios.

**El software:**

1. Cualquier cuenta puede reportar el contenido de una alerta (`POST /denuncias/:id/reportes`).
2. El operador revisa el reporte y, si corresponde, oculta la foto a terceros con un comando en
   el servidor (`deploy/ocultar-contenido.sh`). Lo oculta en la app y en la ficha pública.

**Lo que no hace:**

- no borra la denuncia;
- no la cierra;
- no toca la declaración;
- no sanciona a nadie.

Cada ocultamiento es de solo inserción y queda con su fecha y su motivo
(`ocultamientos_contenido`).

**Propuesta para 4.1.3:**

> «El sistema no contempla un cliente administrativo: la regulación del comportamiento de los
> usuarios se resuelve mediante el régimen de sanciones graduales. La única intervención manual
> es la que exige la política de contenido de Google Play: ante un reporte, el operador puede
> dejar de mostrar a terceros la fotografía de una alerta, sin borrarla, cerrarla ni sancionar a
> nadie, y el ocultamiento queda registrado.»

---

## B. Datos para completar los marcadores

**SUS, con los datos del Anexo 9.** Son 8 participantes, P01 a P08. Los dos de la ronda de
verificación no tienen puntaje.

| Dato | Valor |
|---|---|
| Promedio | **71,0**. Coincide con el texto, pero es sobre 8 personas, no 10: conviene decirlo |
| Desviación estándar | 10,7 (muestral; 10,0 si es poblacional) |
| Mínimo / máximo | 54,0 / 86,0 |
| Perfil denunciante (P01–P04) | 76,0 |
| Perfil receptor (P05–P08) | 66,0 |

**Tareas.** El Resumen, el Abstract y las Conclusiones dicen «[x] de las seis». Según la
Tabla 19, son **las seis**.

**Falta completar con la prueba:** la Tabla 21 y el Anexo 11 (ver A9). Los Anexos 8 y 10 los
llenas tú.

---

## C. Precisiones menores

- **2.3.2, «modelo esférico».** PostGIS calcula la distancia sobre `geography` con el **elipsoide
  WGS-84**, no con una esfera.
- **2.5.2, el formato del build.** EAS genera el **AAB** para Google Play. El APK es para la
  distribución directa.
- **2.6.3, las bibliotecas.** Se usa `@vladmandic/face-api` sobre TensorFlow.js. Su modelo es el
  descriptor de 128 dimensiones de dlib.
  - El umbral es **0,45**, más estricto que el 0,6 publicado
    (`verification/domain/comparacion-facial.ts`).
  - El OCR es `tesseract.js`: Tesseract en WebAssembly, en el servidor.
- **4.2.2, el título.** «Verificación del documento» choca con el vocabulario del proyecto. Mejor
  «Registro del documento y comparación facial». Lo mismo en 2.6.4: «los datos obtenidos en la
  verificación» puede ser «en el registro del documento».
- **2.1.1, «víctima».** La palabra aparece en la cita de Hanfland: «la víctima había fallecido».
  Por el vocabulario del proyecto, mejor «el niño o la niña sustraídos».
- **1.5, el alcance de una alerta falsa.** Dice que permanece acotada «hasta su caducidad». Quien
  la presentó puede prolongarla tres veces, así que puede durar hasta 96 horas.
- **4.5.1, WhatsApp.** Se abre directo con la imagen en Android. Si WhatsApp no está instalado, o
  en iOS, se abre el menú de compartir del sistema.
- **4.5.1 y Tabla 13, el código de caso.** Ahora también aparece en el texto que acompaña la
  imagen. El documento ya lo dice; queda bien.
- **Tabla 20 (U-01), la corrección.** Lo que se cambió fue más que un mensaje:
  - el servidor manda los errores de validación como lista, y la alerta de Android con una lista
    cerraba la app: se convierte a texto;
  - los requisitos se muestran en vivo, de rojo a verde;
  - el botón queda desactivado hasta cumplirlos;
  - los mensajes del servidor quedaron en español.

  Está en la compilación 3, del 29/10.
- **Tabla 17 y Anexo 5, defectos que faltan.**

  | Fecha | Defecto |
  |---|---|
  | 29/10 | El teclado tapaba los campos (compilación 3) |
  | 02/11 | La página de seguridad infantil decía «carnet verificado» |
  | 02/11 | El registro del carnet aceptaba 7 u 8 dígitos y el servidor 5 a 12 |
  | 02/11 | La política decía que la constancia se pide «después del retiro» |
  | 02/11 | La foto del carnet y la selfie quedaban en la caché del teléfono |
  | 02/11 | La ruta sin uso `GET /api/users/profile/me` |
  | 03/11 | La barra de navegación de Android tapaba botones y opciones (compilación 5) |

- **Anexo 2, los dispositivos.** Hoy son Android con las compilaciones de producción de EAS,
  distribuidas por Google Play, e iPhone con Expo Go.
- **Anexos 4 y 5, la fecha de la fuente.** Dicen «05/10/2026». Las 30 pruebas citadas en la
  Tabla 16 y en los Anexos 4 y 5 existen con ese nombre y pasan en la ejecución del 02/11, así
  que la fuente puede decir esa fecha.
- **Anexo 6, el escenario ficticio.**
  - **Carnet:** el `9000001` podría ser el de una persona real. Si tiene cuenta, le llegaría el
    aviso de que la denunciaron y podría declararla falsa, lo que deja una falta. Mejor uno que
    empiece con ceros, como `0009001`: ningún carnet real empieza así.
  - **Ojos:** la app ofrece «Cafés oscuros» o «Cafés claros», no «Café».
  - **Calzado:** es «Zapatos», sin color.
  - **Circunstancia:** el rótulo de la app es «Salió de casa y no volvió».
- **Tabla 12, las rutas.** Tiene 11 de las 36 rutas, y la Tabla 10 tiene 8. El anexo de abajo
  trae la lista completa, por si conviene incluirla o aclarar que las tablas muestran las
  principales.
- **Formato.**
  - El índice de tablas salta de la Tabla 6 a la 10.
  - La Tabla 18 aparece como «¡Error! Marcador no definido».
  - Sobre el comentario «Total???» de la Tabla 5: el total está bien. Son 45 tareas y 20 semanas,
    tanto estimadas como reales.

---

## D. Lo que se comprobó y está bien

- **4.4.2, el radio:** fijo según el vínculo (2 000 o 1 000 m), no cambia al prolongar, y el
  nivel corroborado se retiró por los motivos que dice el texto.
- **Tabla 10:** las 8 rutas existen y con esa autorización.
- **Tabla 11 (salvo A11) y 4.2.4, el régimen de sanciones:**
  - siete días de restricción tras una falta;
  - la suspensión exige dos personas distintas;
  - las faltas son permanentes.
- **4.3.1:**
  - el menor va sin foto, y la foto se retira si la fecha se corrige a la de un menor;
  - hay una sola denuncia abierta por persona;
  - solo se corrige antes de firmar;
  - el lugar se reduce a la celda de unos 1 km.
- **4.3.2, la firma y la constancia:**
  - firma Ed25519 con desbloqueo del teléfono;
  - el nombre se contrasta con el del documento;
  - la constancia autoverificable la piden la persona reportada y quien firmó, y cada solicitud
    queda registrada.
- **4.4:**
  - 72 h de antigüedad máxima de la ubicación;
  - se excluyen el autor y las cuentas suspendidas;
  - lotes de 100;
  - 3 reintentos;
  - arrendamiento de 5 min;
  - 2 alertas a la vez;
  - 24 h, o 12 h para un tercero no familiar;
  - 3 prolongaciones, sin notificar.
- **4.5:**
  - cuatro franjas horarias;
  - el reporte se arma en el teléfono;
  - el código de caso de 8 caracteres;
  - el indicador de documento registrado de quien reporta (Tabla 13);
  - el uso del canal se guarda sin la cuenta y con la hora truncada al minuto.
- **Tablas 14 y 15 y Anexo 3:** coinciden con la medición del 02/11 (salvo lo nuevo de la app,
  ver A14).
- **Tabla 16 y Anexos 4 y 5:** las 30 pruebas citadas existen con su nombre textual.
- **La prueba de escala:** «registra completa una emisión a 20 000 destinatarios» existe y pasa.
- **Anexo 2:** las versiones del entorno.

---

## Anexo: las 36 rutas del servidor

Todas van bajo `/api`, salvo las tres páginas legales.

| Método | Ruta | Módulo | En la tesis |
|---|---|---|---|
| POST | `/auth/register` | auth | Tabla 10 |
| POST | `/auth/login` | auth | Tabla 10 |
| POST | `/auth/refresh` | auth | Tabla 10 |
| GET | `/auth/me` | auth | Tabla 10 |
| POST | `/auth/documento/extraer` | auth | Tabla 10 |
| POST | `/auth/documento/registrar` | auth | Tabla 10 |
| POST | `/auth/cuenta/eliminar` | auth | Tabla 10 |
| GET | `/usuarios/me/sanciones` | sanciones | Tabla 10 |
| POST | `/denuncias` | denuncias | Tabla 12 |
| GET | `/denuncias/cercanas` | denuncias | Tabla 12 |
| GET | `/denuncias` | denuncias | Tabla 12 |
| GET | `/denuncias/mias` | denuncias | Tabla 12 |
| GET | `/denuncias/:id` | denuncias | Tabla 12 |
| PATCH | `/denuncias/:id` | denuncias | Tabla 12 |
| POST | `/denuncias/:id/encontrada` | denuncias | Tabla 12 |
| POST | `/declaraciones/denuncias/:id/firmar` | declaraciones | Tabla 12 |
| POST | `/declaraciones/denuncias/:id/prolongar` | declaraciones | Tabla 12 |
| POST | `/denuncias/:id/cierre` | cierres | Tabla 12 |
| POST | `/constancias/denuncias/:id` | constancias | Tabla 12 |
| GET | `/declaraciones/texto-legal` | declaraciones | — |
| GET | `/declaraciones/vinculos` | declaraciones | — |
| POST | `/declaraciones/claves` | declaraciones | — (registro de la clave Ed25519) |
| GET | `/declaraciones/denuncias/:id/contenido` | declaraciones | — (lo que firma el teléfono) |
| GET | `/cierres/denuncias` | cierres | — («Alertas sobre mí») |
| POST | `/alertas/dispositivos` | alertas | — (token de notificación) |
| GET | `/alertas/dispositivos` | alertas | — |
| PUT | `/alertas/ubicacion` | alertas | — (última ubicación) |
| GET | `/autoridad/contacto` | avistamientos | — |
| POST | `/denuncias/:id/uso-canal` | avistamientos | — |
| POST | `/denuncias/:id/reportes` | reportes | — (reporte de contenido) |
| GET | `/fichas/:id` | denuncias | — (ficha pública, sin sesión) |
| GET | `/fichas/:id/foto` | denuncias | — |
| GET | `/salud` | salud | — |
| GET | `/privacidad` | legal | — (fuera de `/api`) |
| GET | `/eliminar-cuenta` | legal | — (fuera de `/api`) |
| GET | `/seguridad-infantil` | legal | — (fuera de `/api`) |
