# Resultados del encargo: pendientes del código y de Google Play

**Fecha:** 2 de noviembre de 2026
**Rama:** `Fix/Reportes`

Los cambios están preparados para commit. El texto completo de la política de privacidad, y cómo
se publica, está en [`politica-de-privacidad.md`](politica-de-privacidad.md).

## Resumen

Varias partes del encargo ya estaban hechas antes de recibirlo. Lo que había, lo comprobé contra
el código y le agregué las pruebas que pide el encargo.

| Ítem | Estado | Qué se hizo ahora |
|---|---|---|
| A1–A4 | Respondido | Información leída del código, sin cambios. Solo A4 cambió algo: el teléfono ahora borra su copia de las fotos del carnet. |
| B1 Carnet con complemento | Ya estaba, desde el 8 de octubre | 5 pruebas de integración nuevas, ayuda en los formularios y largo del número alineado con el servidor |
| B2 Reporte de avistamiento como imagen | **Nuevo** | Imagen generada en el teléfono, enviada directo al chat de WhatsApp en Android, y código de caso también en la ficha pública |
| B3 Datos de muestra | Ampliado | `pnpm seed:demo`: 6 casos ficticios en Cochabamba |
| C1 Eliminar la cuenta | Ya estaba, desde el 27 de octubre | 1 prueba nueva: se conservan las faltas y el bloqueo del documento |
| C2 Ubicación en segundo plano | **No aplica** | La app no la pide. Diego decidió mantenerlo así (ver C2) |
| C3 Política de privacidad | Ya publicada | Texto actualizado y documento para la tesis |
| C4 Seguridad de los datos | Tabla | Más una corrección recomendada para el formulario de Play |
| C5 API 36 y páginas de 16 KB | Comprobado en la configuración | Falta confirmarlo en Play Console |
| Prueba de carga (opcional) | No hecha | `encargo-prueba-de-carga.md` no llegó con el encargo ni está en el repositorio |

---

## 1. Información para la tesis

### A1. Rutas REST

Todas las rutas llevan el prefijo `/api`, salvo las tres páginas legales.

En la columna «Sesión», «Sí» significa que la ruta exige el token de acceso
(`JwtAuthGuard`). Si la cuenta está eliminada, el token deja de valer aunque no haya vencido.

| Método | Ruta | Propósito | Sesión |
|---|---|---|---|
| POST | `/api/auth/register` | Crear la cuenta: correo, contraseña, teléfono y nombre desglosado | No |
| POST | `/api/auth/login` | Iniciar sesión con correo y contraseña | No |
| POST | `/api/auth/refresh` | Renovar el token de acceso, que dura 15 min, con el token de renovación, que dura 7 días | No |
| GET | `/api/auth/me` | Perfil propio: estado de la cuenta y documento registrado | Sí |
| POST | `/api/auth/documento/extraer` | Registro del documento, paso 1: lee el carnet con OCR y lo contrasta con lo declarado | Sí |
| POST | `/api/auth/documento/registrar` | Registro del documento, paso 2: OCR, comparación facial con la selfie y registro del hash del documento | Sí |
| POST | `/api/auth/cuenta/eliminar` | Eliminar la cuenta, con la contraseña | Sí |
| GET | `/api/users/profile/me` | Resto sin uso: devuelve un texto fijo y la app no la llama (ver la sección 4) | Sí |
| POST | `/api/alertas/dispositivos` | Registrar el teléfono para recibir notificaciones | Sí |
| GET | `/api/alertas/dispositivos` | Listar los teléfonos registrados de la propia cuenta | Sí |
| PUT | `/api/alertas/ubicacion` | Informar la última ubicación, con la app abierta | Sí |
| POST | `/api/denuncias` | Presentar una denuncia. Queda REGISTRADA y no se difunde hasta firmarla | Sí |
| GET | `/api/denuncias/cercanas` | Alertas cercanas a un punto, para el mapa | Sí |
| GET | `/api/denuncias` | Alertas recientes, para la lista, sin filtro de distancia | Sí |
| GET | `/api/denuncias/mias` | Las denuncias propias | Sí |
| GET | `/api/denuncias/:id` | Detalle de una alerta. Sin datos de quien la presentó, salvo que sea la propia | Sí |
| PATCH | `/api/denuncias/:id` | Editar una denuncia propia antes de firmarla. Firmada, se rechaza | Sí |
| POST | `/api/denuncias/:id/encontrada` | **«La encontramos»:** cierre por quien denunció. Pasa a CERRADA | Sí |
| GET | `/api/declaraciones/texto-legal` | Texto legal vigente de la declaración jurada | Sí |
| GET | `/api/declaraciones/vinculos` | Vínculos que se pueden declarar con la persona buscada | Sí |
| POST | `/api/declaraciones/claves` | Registrar la clave pública Ed25519 del teléfono | Sí |
| GET | `/api/declaraciones/denuncias/:denunciaId/contenido` | Hash del contenido que el teléfono va a firmar | Sí |
| POST | `/api/declaraciones/denuncias/:denunciaId/firmar` | Firmar la declaración jurada. La alerta se difunde: PROVISIONAL, 2 km y 24 h (1 km y 12 h si quien firma no es familiar) | Sí |
| POST | `/api/declaraciones/denuncias/:denunciaId/prolongar` | **Prolongar la alerta:** otro plazo, sin notificar, firmado con el teléfono, hasta 3 veces | Sí |
| GET | `/api/cierres/denuncias` | Las denuncias que identifican a la cuenta como persona reportada | Sí |
| POST | `/api/denuncias/:denunciaId/cierre` | **Retiro por la persona reportada:** `SIN_SANCION` («Estoy bien») o `CON_SANCION` («Es falsa») | Sí |
| POST | `/api/constancias/denuncias/:denunciaId` | **Solicitud de la constancia.** Cada solicitud queda registrada | Sí |
| GET | `/api/usuarios/me/sanciones` | «Mi situación»: faltas y suspensión | Sí |
| GET | `/api/autoridad/contacto` | Número de teléfono y de WhatsApp de la autoridad | Sí |
| POST | `/api/denuncias/:denunciaId/uso-canal` | **Uso del canal de avistamiento:** solo el canal (`LLAMADA` o `MENSAJE`) y la hora al minuto, sin usuario ni contenido | Sí |
| POST | `/api/denuncias/:id/reportes` | Reportar contenido inapropiado de una alerta | Sí |
| GET | `/api/fichas/:id` | Ficha pública de una alerta, en HTML. Es la que abre el enlace del reporte de avistamiento | No |
| GET | `/api/fichas/:id/foto` | Foto de la ficha pública. Nunca la de un menor ni una oculta | No |
| GET | `/api/salud` | Comprobación de que el servidor está en pie | No |
| GET | `/privacidad` | Política de privacidad | No |
| GET | `/eliminar-cuenta` | Cómo eliminar la cuenta sin la app | No |
| GET | `/seguridad-infantil` | Estándares de seguridad infantil, que exige Google Play | No |

Son 37 rutas. **La verificación de la constancia no es una ruta, y es deliberado.** Se hace fuera
del sistema con `tools/verificar-constancia.mjs` (ver A3). Si fuera una ruta, verificar sería
volver a confiar en el sistema que emitió la constancia.

### A2. Módulos, comparados con el diagrama de componentes

Lo marcado como **corregido** o **falta** es lo que hay que cambiar en el diagrama.

**Capa de entrada**
- Controladores REST: correcto. Agregar dos que no son de la API de la app: la **ficha pública**
  (`FichasController`, sin sesión) y las **páginas legales** (`LegalController`).
- Trabajadores:
  - **Emisión** (`alertas/emision.worker.ts`) y **recibos** (`alertas/recibos.worker.ts`):
    correctos.
  - **Corregido: «lectura del carnet» no es un trabajador de la capa de entrada.** El OCR y la
    comparación facial corren en hilos aparte (*worker threads*) para no bloquear el servidor,
    pero se ejecutan dentro de la petición de registro del documento. Son detalles del Lector
    OCR y del Comparador facial, en la capa de infraestructura.
- Planificador de la caducidad (`denuncias/caducidad.scheduler.ts`): correcto.
- **Falta: Comandos de operación (CLI)** en `src/cli/`: `eliminar-cuenta`, que atiende pedidos
  por correo, y `alerta-de-muestra`, para la revisión de Google Play. Los corre quien opera el
  servidor, no la app.

**Capa de aplicación**
- Correctos: Autenticación (`auth`), Cuentas (`users/cuentas.service.ts`), Registro del
  documento (`verification`), Denuncias, Declaraciones juradas (`declaraciones`, con
  `FirmasService`), Emisión de alertas (`alertas`), Cierres, Sanciones, Constancias y Uso del
  canal de avistamiento (`avistamientos`).
- **Falta: Reportes de contenido** (`reportes`): guarda el reporte y avisa por correo al
  operador.
- **Falta: Ficha pública** (`denuncias/ficha-publica.ts`). Decide qué se muestra sin sesión.
- Detalle: **Dispositivos y Ubicación** viven dentro del módulo de alertas
  (`dispositivos.service.ts`, `ubicacion.service.ts`). Si el diagrama muestra cómo se arma la
  lista de destinatarios, conviene nombrarlos.

**Capa de dominio (reglas puras)**
- Situación de la cuenta y sanciones: `sanciones/domain/situacion.ts` y
  `users/domain/estado-cuenta.ts`. Correcto.
- Edad y fotografía: `denuncias/domain/minoria-edad.ts`. Correcto.
- **Corregido el nombre:** «Zona del último lugar conocido» es `denuncias/domain/zona-avistamiento.ts`,
  una rejilla de 0,01° (unos 1,1 km).
- Mensaje de firma y cadena de resúmenes: `declaraciones/domain/firma-dispositivo.ts` y
  `cadena.ts`. Correcto.
- Vigencia de la alerta: los estados y las transiciones están en `denuncias/domain/estados.ts`.
  Los plazos (24 h, 12 h para quien no es familiar, 3 prolongaciones) y los radios (2 km, 1 km)
  son parámetros en `config/denuncias.config.ts`.
- **Faltan:**
  - **Identidad del documento** (`users/domain/documento-identidad.ts`): número más complemento
    y su hash. Es B1.
  - **Lectura del número del carnet** (`verification/domain/numero-de-documento.ts`).
  - **Comparación de nombres** (`verification/domain/nombres.ts`).
  - **Umbral de la comparación facial** (`verification/domain/comparacion-facial.ts`).
  - **Contenido sellado** (`denuncias/domain/contenido-sellado.ts`): qué campos entran en el
    hash de la denuncia.
  - **Formato de la constancia** (`constancias/domain/documento.ts`).
  - **Código de caso** (`denuncias/domain/codigo-de-caso.ts`): nuevo, de B2.

**Capa de infraestructura**
- Repositorio: TypeORM sobre PostgreSQL 15 con PostGIS 3.5. Correcto.
- Pasarela de notificaciones (`alertas/pasarela-push-expo.ts`, Expo, que entrega por FCM y
  APNs): correcto. Es la única dependencia externa del servidor.
- Lector OCR con Tesseract (`verification/documento/lector-tesseract.ts`, en su hilo): correcto.
- **Corregido: no es un «cliente» del comparador facial.** `comparador-face-api.ts` corre
  face-api sobre TensorFlow.js en el propio servidor, en un hilo aparte (`hilo-de-inferencia.ts`).
  No llama a ningún servicio externo. Se sugiere «Comparador facial (face-api, local)».
- **Falta: Correo** (`reportes/correo.service.ts`, con nodemailer). Avisa al operador de cada
  reporte de contenido.

### A3. Constancia probatoria

**Cómo se genera y quién la pide.** La pide una cuenta con documento registrado en la app, por
`POST /api/constancias/denuncias/:id`. El servidor no la genera nunca por su cuenta, y retirar la
alerta tampoco la entrega. Hay dos alcances:
- **Completa:** para la persona reportada, cuyo hash de documento coincide con el de la denuncia.
- **Solo su propia declaración:** para quien firmó.

Cualquier otra persona recibe la misma respuesta que si la denuncia no existiera.

**Qué contiene.** Es un JSON con formato `constancia-denuncia/v3` y trae:
- el contenido sellado de la denuncia, en forma de texto canónico;
- cada declaración jurada con sus campos sellados, su `hash_registro`, su `hash_anterior`, la
  firma Ed25519 del teléfono y la clave pública;
- el nombre del documento y el hash del carnet de cada firmante;
- el texto legal entero que se aceptó;
- una sección `verificacion` con el procedimiento y sus límites escritos.

**Cómo se verifica.** Sí, hay un verificador independiente: `tools/verificar-constancia.mjs`,
documentado en `tools/verificacion-constancia.md`. No depende del repositorio, de bibliotecas ni
del servidor; usa solo el módulo `crypto` de Node. Recalcula cada hash y verifica cada firma con
la clave pública que trae el documento. Cualquiera puede reimplementarlo, porque el procedimiento
va dentro de la constancia.

**Qué se registra de cada solicitud.** Cada solicitud agrega una fila a
`solicitudes_constancia`, sin unicidad: la denuncia, la cuenta que la pidió, el hash del documento
de esa persona, el alcance entregado y la fecha y hora.

**La frase de la tesis, revisada.** Es correcta en tres puntos y hay que corregir uno:
- **«Un paquete autoverificable»:** correcto.
- **«Su posición en la cadena»: incorrecto.** La cadena es global: `hash_anterior` apunta a la
  declaración anterior del sistema, que casi siempre es de otra denuncia. Esa declaración no se
  incluye, porque revelaría datos de terceros. La constancia lo dice en sus propios límites:
  acredita la integridad de cada registro, no su posición en la cadena completa.
- **«Cualquier alteración se detecta al recalcular sus resúmenes»:** correcto para alteraciones
  posteriores al sellado. Sin firma del teléfono, en las declaraciones anteriores a la H6.3, no
  descarta que el propio operador fabricara el registro desde el inicio. La firma es lo que cierra
  esa puerta.
- **«Cada solicitud queda registrada»:** correcto.
- **«Es el único medio para conocer la identidad de quien presentó una denuncia»:** correcto
  dentro de la aplicación (I8). Fuera de ella hay una excepción declarada en la política: ante
  material de abuso sexual infantil, el operador denuncia con los datos de la cuenta.

Redacción propuesta:

> «Un paquete autoverificable que contiene la declaración, su firma del teléfono y los datos para
> recalcular sus resúmenes, de modo que cualquier alteración posterior se detecta sin consultar al
> sistema; cada solicitud queda registrada, y es el único medio que ofrece la aplicación para
> conocer la identidad de quien presentó una denuncia.»

### A4. Imágenes del carnet

**En el servidor no se conservan.** Viajan en base64 dentro de la petición de registro del
documento:
- se decodifican en memoria (`Buffer`);
- el OCR lee el anverso y la comparación facial usa el anverso y la selfie, cada uno en su hilo;
- se descartan al terminar la petición.

No se escriben en disco ni en la base de datos, y tampoco se guarda el descriptor facial: la
entidad `users` no tiene ninguna columna de imagen. Del carnet queda solo el hash del número y el
nombre del documento (`verification.service.ts`).

**En el teléfono sí quedaba una copia, y se corrigió.** La cámara guarda la foto en la caché
privada de la app, y la versión reducida también se guardaba ahí. No estaban en la galería, pero
seguían ahí hasta que el sistema limpiara la caché. Ahora la app borra las dos en cuanto las
convierte a base64 (`services/imagenes.ts`, `IDPhotoScreen.tsx`, `SelfieScreen.tsx`). El base64
vive solo en memoria y se limpia al terminar el registro.

Para la política de privacidad: las imágenes del carnet y la selfie se procesan en el servidor y
se descartan en el mismo momento. No se guardan las imágenes ni ninguna medida del rostro. Es lo
que la política ya decía.

---

## 2. Cambios de B y C

### B1. Carnet con número, complemento y extensión

**Ya implementado el 8 de octubre de 2026.** La propuesta del encargo coincide con lo que hay, y no
encontré ningún motivo técnico en contra.
- **Identidad:** número más complemento. La forma canónica es `numero` o `numero-COMPLEMENTO`, en
  mayúsculas y sin espacios. El hash es el SHA-256 de esa cadena (`hashDeDocumento` en
  `users/domain/documento-identidad.ts`).
- **Compatibilidad:** sin complemento, el hash es idéntico al de antes. Por eso no hubo
  migración y las cuentas de la beta no cambiaron.
- **Extensión (LP, CB, SC…):** no entra en la unicidad ni se guarda.
  - El OCR solo lee un complemento si va pegado al número con guion, así que la sigla del
    departamento nunca se confunde con uno.
  - En los formularios, el campo del número solo admite dígitos, así que la sigla no se puede
    escribir. Ahora además lo explica: «Solo los dígitos. Si tu carnet dice LP, CB u otra sigla
    después del número, no la escribas».
- **Los cuatro lugares usan la misma función:**
  1. el registro de la cuenta (`verification.service.ts`);
  2. la denuncia (`denuncias.service.ts`);
  3. el aviso a la cuenta cuyo documento coincide (se compara el mismo hash);
  4. los documentos bloqueados (se guarda y se consulta el mismo hash).

**Cambios de ahora:**
- `verification.service.int-spec.ts`: 5 pruebas de integración nuevas que recorren el registro
  completo:
  - con complemento;
  - sin complemento, con el hash de siempre;
  - mismo número con distinto complemento, que son dos personas y se registran las dos;
  - extensión ignorada;
  - un bloqueo que alcanza solo al documento bloqueado y no al mismo número con otro complemento.

  Ya existían las pruebas unitarias de la forma canónica, en `documento-identidad.spec.ts` (5), y
  de la lectura del OCR, en `numero-de-documento.spec.ts` (11, entre ellas la de «1234567 LP»).
  Ya existía también la del aviso a una sola persona cuando el complemento difiere, en
  `denuncias.service.int-spec.ts`.
- `PersonalDataScreen.tsx`: el teléfono exigía 7 u 8 dígitos y el servidor admite de 5 a 12.
  Quedó alineado (ver la sección 4).
- `ReportarDenunciaScreen.tsx`: la misma ayuda sobre la sigla.

### B2. Reporte de avistamiento con el nombre de quien reporta, como imagen

**Qué cambió.** El reporte se genera en el teléfono como **imagen PNG**, con
`react-native-view-shot` 5.1.0, la versión que Expo SDK 57 declara compatible. Elegí imagen y no
PDF porque WhatsApp muestra la imagen en el chat sin abrir nada, y porque la misma vista sirve en
pantalla para la llamada.

**Campos de la imagen**, en este orden:
1. Caso: código de 8 caracteres, por ejemplo `5C3F0D7E`.
2. Persona buscada.
3. Descripción: la física de la alerta, en una línea.
4. Zona aproximada: la calle más cercana y las coordenadas.
5. Franja horaria: en horas reales, por ejemplo «entre las 14:10 y las 14:40 del 01/10/2026».
6. Reporta: el nombre de la cuenta y si tiene documento registrado.
7. «Generado el 01/10/2026 a las 14:40 en el teléfono de quien reporta.»

**El nombre de quien reporta no se puede editar.** Sale de la cuenta, y la cuenta no deja
cambiarlo: con documento registrado es el que se contrastó contra el carnet. No hay ningún campo
para escribirlo.

**El caso.** El sistema no tiene número de caso policial: el de la FELCC no es público y se quitó
del sistema el 4 de octubre. El «caso» es un código que se calcula del identificador de la
alerta. **La ficha pública ahora muestra el mismo código** («Persona desaparecida · Caso
5C3F0D7E»), así que quien recibe el reporte y abre la ficha ve que hablan de la misma alerta.

**Por WhatsApp:**
- **En Android**, la app abre el chat de la autoridad con la imagen y un texto corto ya
  adjuntos, en un toque. El texto lleva el código de caso, el enlace al mapa y el de la ficha. Lo
  hace un módulo nativo pequeño, `modules/compartir-whatsapp`, porque `wa.me` no admite archivos.
- **Si no se puede** (en iOS, o sin WhatsApp instalado), se abre el menú de compartir del sistema
  con la imagen.

El texto corto no repite los datos de la imagen. Así, lo que sí se puede editar no puede
contradecir lo que no se puede editar.

**Por llamada:** la pantalla muestra la misma tarjeta que se envía como imagen, para leerla
durante la llamada.

**La regla del servidor se mantiene (I2).** La imagen se arma en el teléfono y va de ahí a
WhatsApp. El servidor solo registra el uso anónimo del canal, igual que antes.

**Límite, para declararlo.** Una imagen no es infalsificable: se puede retocar con otra
aplicación. Lo que cambia es que ya no basta con borrar y escribir antes de enviar. La garantía
sigue siendo que la Policía comprueba el aviso con sus propios medios: tiene el número de quien
lo manda y la ficha del caso.

**Archivos:**
- `apps/mobile/src/utils/reporte-avistamiento.ts`
- `apps/mobile/src/components/TarjetaDeReporte.tsx` (nuevo)
- `apps/mobile/src/screens/main/ReportarAvistamientoScreen.tsx`
- `apps/mobile/src/screens/main/DenunciaDetailScreen.tsx`, que pasa la descripción
- `apps/mobile/src/services/whatsapp.ts` (nuevo)
- `apps/mobile/modules/compartir-whatsapp/` (nuevo, en Kotlin)
- `apps/backend/src/denuncias/domain/codigo-de-caso.ts` (nuevo)
- `apps/backend/src/denuncias/ficha-publica.ts`

**Pruebas:**
- `reporte-avistamiento.spec.ts`, en la app:
  - los campos en orden;
  - el mismo código que la ficha;
  - la cuenta con o sin documento registrado;
  - sin cuenta, sin descripción y sin calle;
  - que no lleva carnet ni número de la FELCC;
  - que el texto corto lleva los enlaces y no repite los datos de la imagen.
- En el servidor:
  - `codigo-de-caso.spec.ts` (2 pruebas);
  - `ficha-publica.spec.ts`, que comprueba que la ficha muestra el código de caso.

**No probado todavía:** el módulo de Kotlin no se puede compilar en esta máquina, que no tiene el
SDK de Android. Se compila recién en EAS. El bundle de la app sí compila para Android y para web.

### B3. Datos de muestra

**Comando:**

```bash
pnpm seed:demo
```

Es `tools/datos-demo.sh` ampliado. Crea seis cuentas, con contraseña `Demo1234` y documento
registrado, y **seis casos ficticios en el área metropolitana de Cochabamba**. Todos están
firmados como lo hace el teléfono, con Ed25519.

| Zona | Persona buscada | Edad | Rasgos y vestimenta | Lo presenta |
|---|---|---|---|---|
| Centro (Cercado) | Luis Mamani Choque | 38 | Trigueño, 1,70–1,80 m, cicatriz; chompa azul y jean negro; requiere medicación | Su madre |
| La Cancha | Rosa Céspedes Flores | 68 | Canosa, lentes; chompa rosada y pollera azul; dificultad para orientarse | Su hijo |
| Sacaba | Kevin Arnez Torrico | 15 | Polerón gris y pantalón deportivo azul. **Sin foto: es menor** | Su madre |
| Quillacollo | Wilfredo Choque Gutiérrez | 45 | Cicatriz y tatuaje; chaqueta verde y pantalón de tela café | Su esposa |
| Tiquipaya | Daniela Soria Pinto | 22 | Tatuaje; casaca negra, jean azul y botas | Una amiga: alerta de 12 h |
| 1 km al norte del centro | Jorge Vaca Saavedra | 78 | Abrigo café; dificultad para orientarse. **Ya vencida** | Su hija |

- **Nada es real:** nombres inventados, carnets de prueba y la foto de los adultos es la silueta
  rotulada «EJEMPLO».
- **Solo corre en una máquina de desarrollo.** Si se le apunta al servidor de la beta, se niega:
  sus contraseñas son públicas y su limpieza desactiva los disparadores de solo inserción.
- Lo corrí contra la base de pruebas y quedaron las seis denuncias como se esperaba: la del
  menor sin foto, la de la amiga a 12 h y la vencida en CADUCADA.

Archivos: `tools/datos-demo.sh` y `package.json`, en la raíz.

### C1. Eliminar la cuenta desde la app

**Ya implementado el 27 de octubre de 2026.** Se elimina desde Perfil → Eliminar mi cuenta,
confirmando con la contraseña. En la web está https://alertatemprana.download/eliminar-cuenta.

**Se borra:** nombre, correo, teléfono, contraseña, última ubicación, dispositivos y token de
notificaciones. La sesión deja de valer en la siguiente petición. Las imágenes del carnet no hay
que borrarlas, porque no se conservan (A4). Los tokens de renovación son JWT sin estado, pero
cualquier petición con un token de una cuenta eliminada se rechaza.

**Se conserva:**
- el hash del documento;
- las denuncias, que dejan de difundirse y pasan a CADUCADA;
- las declaraciones juradas, con el nombre del documento si firmó alguna;
- las faltas;
- el bloqueo del documento, si la cuenta estaba suspendida.

Si la persona vuelve con el mismo carnet, recupera la misma cuenta con sus faltas. Si no fuera
así, eliminar la cuenta serviría para escapar de una sanción.

**Pruebas:** `cuentas.service.int-spec.ts`, con 10 pruebas, una de ellas nueva: las faltas se
conservan y el documento de una cuenta suspendida sigue bloqueado.

### C2. Ubicación en segundo plano

**No aplica, y Diego decidió mantenerlo así.**

La app no pide ubicación en segundo plano: no declara `ACCESS_BACKGROUND_LOCATION` y no tiene una
tarea de fondo. Solo pide la ubicación con la app abierta. Google exige el aviso destacado
únicamente a las apps que piden la ubicación en segundo plano. Pedirla obligaría además a llenar
una declaración en Play Console, con un video, y a pasar una revisión más estricta.

**Cómo funcionan hoy las alertas con la app cerrada:** sí llegan. El servidor busca a los
teléfonos cuya última ubicación conocida está dentro del radio y fue informada en las últimas
72 horas. Esa ubicación se actualiza cada vez que la persona abre la app.

La política de privacidad ya dice: «La aplicación no usa tu ubicación en segundo plano».

Si en el futuro se agrega, el texto del aviso que propone el encargo sirve, salvo un detalle: la
app se llama «Alerta Temprana», sin «CBBA».

### C3. Política de privacidad publicada

**Ya está publicada:** https://alertatemprana.download/privacidad. Es la URL declarada en Google
Play.

El archivo `politica-de-privacidad.html` que mencionaba el encargo no llegó. Tampoco hizo falta
GitHub Pages: la política la sirve el propio backend desde una sola fuente. El detalle está en
[`politica-de-privacidad.md`](politica-de-privacidad.md), con el texto completo.

**Lo que el encargo pedía completar:**
- **Fecha:** vigente desde el 2 de noviembre de 2026. Se actualizó porque el texto cambió hoy.
- **Imágenes del carnet:** se procesan y se descartan; no se guardan las imágenes ni ninguna
  medida del rostro. Es la respuesta de A4.
- **Ruta para eliminar la cuenta:** Perfil → Eliminar mi cuenta en la app, o
  https://alertatemprana.download/eliminar-cuenta sin ella.
- **Correo de contacto:** dferrufinoc@gmail.com.
- **Enlaces en la app:** ya estaban, en «Crear cuenta» y al pie de «Perfil».

**Cambios de hoy al texto:**
- **El avistamiento:** ahora dice que va por WhatsApp como imagen, con el nombre de quien
  reporta, el lugar y la hora.
- **La constancia:** decía que la persona reportada la pide «después de retirarla», y el código
  la entrega desde que la denuncia está firmada. Se corrigió el texto (ver la sección 4).
- **Lo que se conserva al eliminar la cuenta:** ahora menciona el bloqueo del documento de una
  cuenta suspendida.
- **La página de seguridad infantil:** decía «carnet de identidad verificado» y «ID-verified».
  Ahora dice «documento de identidad registrado».

### C4. Formulario de seguridad de los datos

La columna «¿Cifrado en tránsito?» vale **Sí (HTTPS)** para todo, así que no se repite en la
tabla. «Recopila» quiere decir que el dato llega al servidor. Google no cuenta como «compartir»
lo que reciben los proveedores que hacen funcionar el servicio (Expo, FCM y Oracle), ni lo que el
usuario publica a sabiendas, como una alerta.

| Tipo de dato | ¿Se recopila? | ¿Se comparte? | Para qué | ¿Se puede pedir que se elimine? |
|---|---|---|---|---|
| Nombre de la cuenta | Sí, obligatorio | **Sí**, el de quien firma una declaración: va en la constancia que recibe la persona reportada | Cuenta, atribución de la denuncia, prevención de fraude | Se borra el de la cuenta. El del documento se conserva si firmó alguna declaración |
| Correo electrónico | Sí, obligatorio | No | Inicio de sesión | Sí |
| Teléfono | Sí, obligatorio | No | Dato de la cuenta | Sí |
| Contraseña | Sí, solo su hash | No | Inicio de sesión | Sí |
| Número de carnet | Sí, solo su hash; opcional, para denunciar | **Sí**, el hash de quien firma va en la constancia | Atribución, unicidad del documento, sanciones | No: se conserva para que eliminar la cuenta no evada una sanción |
| Foto del carnet y selfie | Se procesan y se descartan en la misma petición | No | Registro del documento: OCR y comparación facial | No aplica, no se guardan |
| Ubicación precisa (la última) | Sí, opcional: sin ella no llegan alertas; solo con la app abierta | No | Saber quién está en el radio de una alerta | Sí |
| Datos de la persona buscada: nombre, descripción, foto si es mayor, zona de ~1 km | Sí, los escribe quien denuncia | Se publican en la alerta y en la ficha pública | Difundir la alerta | No a pedido de quien la presentó: la denuncia es de solo inserción. La persona reportada puede retirarla, y una foto se borra si es material de abuso |
| Declaraciones juradas y clave pública del teléfono | Sí | Van en la constancia | Atribución verificable | No: solo inserción (I4) |
| Reportes de contenido | Sí | No | Moderación | No: solo inserción |
| Token de notificaciones e identificador del teléfono | Sí, obligatorio | No | Enviar las alertas | Sí |
| Reporte de avistamiento | **No**: no llega al servidor. Solo el uso anónimo del canal | No | Medir la intención de reporte | No aplica |

**Corrección recomendada en Play Console.** La guía de publicación marcaba como compartido solo
el **Nombre**. La constancia también entrega el **hash del carnet** de quien firmó, que en Play es
«Información personal → Otra información». Conviene marcarlo también como compartido, con el
propósito «Prevención de fraudes, seguridad y cumplimiento». Declarar de más no se sanciona;
omitirlo, sí.

### C5. API objetivo 36 y páginas de 16 KB

Comprobado en la configuración del build:
- **API objetivo 36 y compilación con la 36.** Son los valores por defecto de React Native 0.86,
  que es el que trae Expo SDK 57, y `app.json` no los cambia.
- **NDK 27.1.**
- **Páginas de 16 KB:** el plugin de Gradle de React Native, Reanimated y Worklets compilan su
  código nativo con el soporte de páginas flexibles. Son las bibliotecas de esta app que traen
  código C++.

**Falta confirmarlo en Play Console.** Hay que abrir el explorador de paquetes de la app, en la
versión 3 o en la siguiente, y comprobar que dice que la versión admite páginas de memoria de
16 KB. La versión 3 es la primera con Reanimated. Si se quiere, se puede bajar el `.aab` de EAS y
revisar la alineación de cada `.so`.

---

## 3. Lo que cambia en la tesis

**Total de pruebas,** ejecutadas el 2 de noviembre de 2026 a las 16:10 (hora de Bolivia), todas en
verde:

| Conjunto | Suites | Pruebas |
|---|---|---|
| Backend, unitarias (`pnpm test`) | 28 | 263 |
| Backend, integración contra PostgreSQL y PostGIS (`pnpm test:integration`) | 14 | 310 |
| App móvil (`npx jest` en `apps/mobile`) | 11 | 56 |
| **Total** | **53** | **629** |

La tesis dice hoy «508 pruebas en 35 suites». Si la tesis cuenta solo el backend, el número
comparable es **573 pruebas en 42 suites**.

**Campos finales del reporte de avistamiento:**
- **En la imagen:** caso, persona buscada, descripción, zona aproximada, franja horaria, reporta
  (nombre y si tiene documento registrado) y fecha y hora de generación.
- **En el texto que acompaña a la imagen:** el código de caso, el enlace al mapa y el enlace a la
  ficha.

**Pantallas que hay que volver a capturar.** Para todas, primero hay que correr
`pnpm seed:demo` y apuntar la app al servidor local.
- «Vi a esta persona», con la tarjeta del reporte y los botones de llamar y de WhatsApp.
- El chat de WhatsApp con la imagen recibida, en un teléfono Android.
- La ficha pública abierta desde el enlace, que ahora muestra «Caso …».
- «Crear cuenta», con la lista de requisitos de la contraseña en rojo y en verde.
- «Documento: datos» y «Reportar», por la ayuda sobre la sigla del departamento.
- El mapa y la lista de alertas, con los casos nuevos de Cochabamba.
- La política de privacidad, si aparece en la tesis, porque cambió la fecha y el texto.

**URL de la política de privacidad:** https://alertatemprana.download/privacidad

---

## 4. Defectos encontrados en el camino

| Fecha | Qué fallaba | Cómo se detectó | Qué se cambió |
|---|---|---|---|
| 2026-10-28 | La sesión no se retomaba al abrir la app: pedía iniciar sesión cada vez y, sin sesión, el teléfono dejaba de informar su ubicación. A las 72 h dejaba de recibir alertas | Diego notó que debía entrar cada vez y preguntó si eso afectaba a las notificaciones. Se revisó `App.tsx` | `restaurarSesion` en el store, con 3 pruebas |
| 2026-10-29 | La app se cerraba en Android al crear una cuenta con una contraseña débil: el servidor manda los errores como lista, y `Alert.alert` con una lista hace caer la app | Reporte de Diego en la prueba interna | El mensaje se convierte a texto una sola vez, en el cliente HTTP. Requisitos de la contraseña en vivo y botón desactivado. Mensajes del servidor en español. 10 pruebas |
| 2026-10-29 | En Android el teclado tapaba el campo en el que se escribía | Reporte de Diego en la prueba interna | `react-native-keyboard-controller` en las 8 pantallas con campos. Sin prueba automática: las pantallas se verifican a mano |
| 2026-11-02 | La página de seguridad infantil decía «carnet de identidad verificado» («ID-verified»), contra el vocabulario del proyecto y la I6 | Revisión del vocabulario que pide este encargo | «Documento de identidad registrado» |
| 2026-11-02 | Quedaba `HomeScreen.tsx`, una pantalla sin uso con el rótulo «VERIFICADO» | La misma revisión | Pantalla eliminada |
| 2026-11-02 | El registro del documento exigía 7 u 8 dígitos y cortaba el campo en 8, pero el servidor admite de 5 a 12 y la denuncia deja escribir 12. Una persona con un carnet de más o menos cifras podía ser reportada, pero no registrar su documento | Al comparar los campos de carnet para B1 | Validación y largo alineados con el servidor, de 5 a 12 |
| 2026-11-02 | La política decía que la constancia se pide «después de retirarla», pero el código la entrega desde que la denuncia está firmada | Al responder A3 | Se corrigió el texto, no el código. Si el tribunal quiere que sea solo después del retiro, es una condición en `ConstanciasService` |
| 2026-11-02 | La foto del carnet y la selfie quedaban en la caché privada de la app hasta que el sistema la limpiara | Al responder A4 | La app las borra en cuanto las convierte |

Además encontré algo que **no cambié**, porque no era parte del encargo:
`GET /api/users/profile/me` es un resto sin uso que devuelve un texto fijo. Conviene quitarla.

---

## 5. Lo que tiene que hacer Diego

1. Hacer commit y push.
2. Actualizar el servidor. Así se publican la política con su fecha nueva, la página de seguridad
   infantil corregida y el código de caso en la ficha:

   ```bash
   ssh oracle '~/alertas/deploy/actualizar.sh'
   ```
3. Hacer un build nuevo. B2 trae dos piezas nativas: `react-native-view-shot` y el módulo de
   WhatsApp. **El Kotlin se compila por primera vez en EAS**, así que conviene probar el envío
   por WhatsApp en un teléfono Android antes de promover la versión a la prueba cerrada.
4. En Play Console:
   - marcar como compartido el hash del carnet (C4);
   - confirmar el soporte de 16 KB (C5).
