# Resultados del encargo: cierre de datos para la tesis

**Fecha:** 2 de noviembre de 2026
**Rama:** `Fix/Reportes`, sobre el commit `02dfe46` más el cambio de D1, que queda preparado
para commit.

Continúa [`encargo-resultados-pendientes.md`](encargo-resultados-pendientes.md).

## Resumen

| Parte | Estado |
|---|---|
| D1. Ruta sin uso | Quitada. La app no la llamaba. Ninguna prueba la cubría, así que los totales no cambian |
| D2. Build de EAS | **Compiló**, módulo de WhatsApp incluido (versionCode 4). Falta probar el envío en un teléfono |
| D3. Despliegue | **No hecho**: falta la confirmación de Diego. El servidor sigue en el commit `4b3014b` del 28 de octubre |
| A. Pruebas | 629 pruebas en 53 suites, todas pasan. Cobertura del servidor: 74,9 % de líneas |
| B. Radio | El código no implementa el modelo del apartado 4.4.2. El radio es fijo según el vínculo, y nunca dependió del tiempo |
| C. Beta | **Todavía no hay simulacros en el servidor**: hay una sola emisión, con 0 destinatarios. La consulta está lista para cuando Diego indique las fechas |

---

## 1. D: cambios

### D1. `GET /api/users/profile/me`

- **Antes:** la ruta devolvía un texto fijo («Profile endpoint - to be implemented»).
- **Uso desde la app:** ninguno. Su perfil lo pide a `GET /api/auth/me`
  (`apps/mobile/src/services/auth.service.ts:136`).
- **Pruebas:** no había ninguna sobre la ruta, así que no se quitó ninguna.
- **Qué se cambió:**
  - Se eliminó `apps/backend/src/users/users.controller.ts`, que solo tenía esa ruta.
  - `UsersModule` quedó sin controladores.
  - El comentario que explicaba por qué el módulo no expone la ficha de otra persona ni la
    edición de una cuenta pasó a `users.module.ts`.
  - De paso se corrigió el `README.md`, que listaba rutas que ya no existen:
    `GET /api/users/:id`, `PUT /api/users/:id` y `POST /api/auth/verify-identity`.
- **Comprobación:** `tsc` pasa sin errores y las 573 pruebas del servidor siguen pasando.
- **Efecto en la tesis:** el servidor expone ahora **36 rutas**. La tabla A1 del encargo
  anterior pierde la fila de `/api/users/profile/me`.

### D2. Build de Android en EAS

- **Lanzado:** 2026-11-02, 17:56 (UTC−4), perfil `production`, versionCode 4.
- **Build:** `491ab4a5-6c36-469f-ba96-803a762a2326`
  ([registro](https://expo.dev/accounts/ferrudiegoo/projects/alerta-temprana/builds/491ab4a5-6c36-469f-ba96-803a762a2326)).
- **Qué compila:** el código de la app es el del commit `02dfe46`, porque D1 solo toca el
  servidor. Es la primera compilación del módulo `modules/compartir-whatsapp`, que no se pudo
  compilar en el Mac por no tener el SDK de Android.
- **Resultado: compiló.** Terminó a las 18:28, 32 min después de lanzarlo; Gradle informa
  `BUILD SUCCESSFUL in 13m 3s`.
- **El módulo se compiló de verdad**, sin errores ni advertencias:
  - el registro muestra las tareas `:compartir-whatsapp:compileReleaseKotlin` y
    `:compartir-whatsapp:compileReleaseJavaWithJavac`;
  - el módulo ocupó 52 s del build.
- **Artefacto:** el `.aab` para Google Play, versionCode 4.
- **Falta probarlo en un teléfono.** Que compile no prueba que WhatsApp abra el chat de la
  Policía con la imagen. Hay que subirlo a la prueba interna de Play Console y probarlo en un
  Android antes de pasarlo a la prueba cerrada.

### D3. Despliegue

No se desplegó, porque Diego no lo confirmó en esta sesión.

El servidor está en el commit `4b3014b` (28 de octubre, 22:40). Desplegar llevaría:

- `7789239`: los mensajes de validación del registro en español.
- `02dfe46`:
  - el texto y la fecha nuevos de la política de privacidad;
  - la corrección de vocabulario de la página de seguridad infantil;
  - el código de caso en la ficha pública, que es el que la Policía ve en el reporte de
    avistamiento nuevo.
- D1: la ruta quitada.

**Pasos, cuando Diego lo confirme:**

1. Diego hace commit y push de D1. `actualizar.sh` baja la rama desde el repositorio remoto.
2. Se ejecuta `ssh oracle '~/alertas/deploy/actualizar.sh'`.
3. Se comprueba `GET https://alertatemprana.download/api/salud`.

---

## 2. A: datos de las pruebas

### A1. Totales y duración por conjunto

**Ejecución:** 2026-11-02, de 18:00 a 18:02 (UTC−4), en el equipo de A4, sobre el commit
`02dfe46` más el cambio de D1. Ninguna prueba falló ni se omitió.

| Conjunto | Suites | Pruebas | Duración |
|---|---|---|---|
| Unitarias del servidor | 28 | 263 | 6,5 s |
| Integración del servidor | 14 | 310 | 41,2 s |
| App móvil | 11 | 56 | 3,8 s |
| **Total** | **53** | **629** | **51,5 s** |

**Cómo se midió:**

- La duración es la que informa Jest (`Time`).
- Las de integración corren en serie, en un solo proceso, contra PostgreSQL con PostGIS en
  Docker.
- La medición de cobertura (A2) corre juntas las 573 pruebas del servidor y tardó 38,4 s con la
  instrumentación activa.

**App móvil por archivo:**

| Archivo | Pruebas |
|---|---|
| `utils/reporte-avistamiento` | 18 |
| `components/mapa/clave-de-google` | 6 |
| `utils/contrasena` | 6 |
| `utils/texto-legal` | 5 |
| `services/restricciones` | 4 |
| `utils/mensaje-de-firma` | 4 |
| `store/auth.store` | 3 |
| `utils/mensaje-del-servidor` | 3 |
| `services/ubicacion` | 3 |
| `utils/documento` | 2 |
| `utils/sitio` | 2 |

### A2. Cobertura del servidor por capa

**Cómo se midió:**

- Una sola ejecución de Jest corre juntas las pruebas unitarias y las de integración del
  servidor, con la instrumentación de Istanbul.
- Se mide sobre `src/**/*.ts`. Quedan fuera las pruebas, las migraciones (se comprueban al
  aplicarse en cada ejecución de integración) y `main.ts`.

| Capa | Archivos | % de líneas | % de ramas | % de funciones |
|---|---|---|---|---|
| Dominio (reglas puras) | 19 | 99,6 % | 94,3 % | 100 % |
| Entidades (esquema) | 18 | 99,6 % | 100 % | 96,8 % |
| Servicios y procesos | 20 | 84,6 % | 76,9 % | 85,5 % |
| Adaptadores, configuración y otros | 27 | 76,3 % | 68,3 % | 77,0 % |
| Validación de entrada (DTO) | 15 | 58,8 % | 62,5 % | 44,4 % |
| *Controladores HTTP* | 12 | 30,0 % | 68,2 % | 21,4 % |
| *Cableado de módulos* | 12 | 0 % | 0 % | 0 % |
| **Total** | **123** | **74,9 %** (1 936 de 2 586) | **76,4 %** (504 de 660) | **77,0 %** (362 de 470) |

Las sentencias suman 74,4 % (2 153 de 2 895). El 5 de octubre el total de líneas era 70,2 %.

**Dos filas más de las pedidas.** El encargo pide cinco capas, pero los controladores y los
módulos también son archivos del servidor. Si se suman a «otros», esa fila baja a 52,2 % de
líneas y oculta dónde está el hueco. Se dejan aparte para que el total cuadre.

**Qué archivos van en cada capa:**

- **Dominio:** los de las carpetas `domain/`.
- **Entidades:** los de `entities/`.
- **Servicios y procesos:**
  - los `*.service.ts`, `*.worker.ts` y `*.scheduler.ts`;
  - `muestra/alerta-de-muestra.ts`.
- **Adaptadores, configuración y otros:**
  - la pasarela push, el lector OCR y el comparador facial;
  - las guardas y estrategias de autenticación;
  - `config/`, los filtros y los comandos de `cli/`;
  - la ficha pública y las páginas legales.
- **DTO:** los de `dto/`.
- **Controladores HTTP:** los `*.controller.ts`.
- **Cableado de módulos:** los `*.module.ts`.

**Huecos que hay que explicar en el texto:**

- **Controladores, módulos y DTO.** Las pruebas de integración arman solo las piezas que
  necesitan, sin la capa HTTP. Por eso la cobertura de controladores y módulos es baja, y por
  eso los DTO de firmar, prolongar o cerrar quedan en 0 %: solo se cargan al pasar por esa
  capa.
- **Controladores con pruebas propias:** los de la ficha pública, las páginas legales y la
  salud están en 100 %.
- **`auth.service`: 0 %.** Sigue sin pruebas automáticas: registro, inicio de sesión y
  renovación de sesión. Va en limitaciones.
- **`emision.worker` y `recibos.worker`: 0 %.** Son envoltorios de pocas líneas. La lógica que
  invocan, en `alertas.service`, está en 100 % de líneas.
- **`hilo-de-inferencia`: 0 %** aunque se ejecuta. Corre en un hilo aparte que Istanbul no
  mide.
- **Comandos de `cli/`: 0 %.** Son la entrada por línea de comandos. Lo que ejecutan
  (`AlertaDeMuestra` y `CuentasService`) sí está probado.
- **`correo.service`: 26 %.** Es el aviso por correo de un reporte de contenido. Sin SMTP
  configurado, solo se registra en el log.

### A3. Pruebas por módulo del servidor

| Módulo | Qué cubre | Unitarias | Integración | Total |
|---|---|---|---|---|
| denuncias | Creación, edición, caducidad, fotografías, menores, vista pública | 68 | 71 | 139 |
| declaraciones | Texto legal, firma, cadena de hashes, prolongaciones | 26 | 55 | 81 |
| alertas | Emisión, entregas, recibos y pasarela push | 23 | 47 | 70 |
| verification | OCR, comparación facial, nombres y número de documento | 35 | 24 | 59 |
| cierres | Retiro por la persona reportada, faltas y suspensión | 0 | 46 | 46 |
| users | Cuentas, correo, documento y eliminación de la cuenta | 13 | 20 | 33 |
| constancias | Constancia autoverificable y registro de cada entrega | 0 | 24 | 24 |
| ficha pública | Página pública del caso y su fotografía | 23 | 0 | 23 |
| config | Validación del entorno y número de la autoridad | 19 | 0 | 19 |
| auth | Validación de registro e inicio de sesión, JWT | 18 | 0 | 18 |
| sanciones | Situación de una cuenta (reglas puras) | 13 | 0 | 13 |
| reportes | Reporte de contenido y su validación | 4 | 8 | 12 |
| avistamientos | Registro del uso del canal | 3 | 8 | 11 |
| comandos de operación | Alerta de muestra para la revisión de Google Play | 0 | 7 | 7 |
| legal | Páginas de privacidad, términos y seguridad infantil | 7 | 0 | 7 |
| common | Filtro de excepciones | 6 | 0 | 6 |
| salud | Estado del servidor y de la base | 3 | 0 | 3 |
| código de caso | Código corto del caso | 2 | 0 | 2 |
| **Total** | | **263** | **310** | **573** |

**Cómo se separaron los módulos nuevos:**

- **Ficha pública:** `denuncias/ficha-publica.spec.ts` (13) y
  `denuncias/fichas.controller.spec.ts` (10).
- **Código de caso:** `denuncias/domain/codigo-de-caso.spec.ts`.
- **Comandos de operación:** `muestra/alerta-de-muestra.int-spec.ts`, que prueba lo que ejecuta
  `cli/alerta-de-muestra.ts`. El otro comando, `cli/eliminar-cuenta.ts`, usa `CuentasService`,
  y esas pruebas cuentan en `users`.

El régimen de sanciones también se ejercita en las pruebas de integración de `cierres`,
`declaraciones` y `denuncias`, que lo aplican contra la base.

### A4. Entorno

| Elemento | Versión | Respecto de la lista del encargo |
|---|---|---|
| Equipo | Mac con Apple M2, 8 GB de memoria | Confirmado; se agrega la memoria |
| Sistema | **macOS 27.2** | **Corregido**: decía 26.6 |
| Node.js | 24.4.1 | Confirmado |
| pnpm | 10.33.2 | Agregado |
| Jest / ts-jest | 29.7.0 / 29.4.11, en el servidor y en la app | Confirmado |
| TypeScript | 5.9.3 en el servidor, 6.0.3 en la app | Confirmado |
| NestJS / TypeORM | 10.4.22 / 0.3.30 | Confirmado |
| PostgreSQL / PostGIS | 15.13 / 3.5.2, en Docker (imagen `postgis/postgis:15-3.5`) | Confirmado; ver la nota |
| Docker | 29.1.3 | Agregado |
| Expo / React Native / React | SDK 57 (57.0.25) / 0.86.3 / 19.2.3 | Confirmado; se agrega React |
| Build de Android | EAS, API objetivo y de compilación 36 | Agregado |

**Nota sobre PostgreSQL en el Mac.** Esa imagen solo existe para x86-64, así que en el M2 corre
emulada. Explica parte de los 41 s de la integración.

**El servidor de la beta** no es el entorno de las pruebas:

| Elemento | Servidor |
|---|---|
| Máquina | Oracle Cloud, ARM64 (Ampere Neoverse-N1), 2 núcleos, unos 12 GB |
| Sistema | Ubuntu 24.04.4 LTS |
| PostgreSQL / PostGIS | 15.19 / 3.6.4, en Docker |
| Node.js | 24.22.2, dentro del contenedor |
| Commit desplegado | `4b3014b` |

Las versiones de PostgreSQL y PostGIS del servidor son posteriores a las de las pruebas. Si la
tesis da un solo entorno, conviene aclarar que las pruebas automáticas corrieron en el Mac.

---

## 3. B: cómo funciona el radio

Resumen: el modelo del apartado 4.4.2 **no está implementado y nunca lo estuvo**.

- **El modelo existió como especificación** de un «radio por comportamiento» (versión 2).
  - Se aprobó en lo conceptual.
  - Quedaron cuatro decisiones abiertas antes de implementarla.
  - El 1 de octubre Diego la dejó como trabajo futuro.
- **El radio actual** lo fija el vínculo declarado, en el momento de firmar, y no cambia
  después.
- **Hubo un tercer nivel con 10 km,** pero se quitó el 4 de octubre, junto con el número de
  caso de la FELCC.

### B1. Cómo se calcula el radio hoy

Es **fijo según el vínculo** y **no depende del tiempo transcurrido** ni de ningún otro dato.

```ts
// apps/backend/src/declaraciones/firmas.service.ts:73
private alcanceSegunVinculo(vinculo: VinculoDeclarado): { radio_m: number; horas: number } {
  const c = this.config;
  return tieneAlcanceReducido(vinculo)
    ? { radio_m: c.radioTerceroNoFamiliarM, horas: c.caducidadTerceroNoFamiliarH }
    : { radio_m: c.radioProvisionalM, horas: c.caducidadProvisionalH };
}
```

`tieneAlcanceReducido` devuelve verdadero solo para `TERCERO_NO_FAMILIAR`
(`declaraciones/domain/vinculos.ts:40`).

**Cuándo se fija.** Se calcula una sola vez, al firmar la declaración jurada
(`firmas.service.ts:382-396`). En la misma transacción:

1. pasa la denuncia a `PROVISIONAL`;
2. guarda el radio en `denuncias.radio_actual_m`;
3. fija `expira_en`;
4. encola la emisión con ese radio.

**Valores de `config/denuncias.config.ts`.** Cada uno se puede sobrescribir con una variable de
entorno del mismo nombre. En el servidor de la beta ninguna está definida, así que rigen los
valores por defecto:

| Parámetro | Valor | Línea |
|---|---|---|
| `radioProvisionalM` (todo vínculo familiar) | 2 000 m | 127 |
| `radioTerceroNoFamiliarM` | 1 000 m | 128 |
| `caducidadProvisionalH` | 24 h | 130 |
| `caducidadTerceroNoFamiliarH` | 12 h | 131 |
| `maxProlongaciones` | 3 | 135 |
| `limiteAlertasProvisionales` | 2 alertas a la vez por cuenta | 142 |
| `antiguedadMaximaUbicacionH` | 72 h | 146 |

**A quién llega.** La consulta de destinatarios está en `alertas/alertas.service.ts:198-228`.
Alcanza a las cuentas que cumplen todo esto:

- tienen un dispositivo registrado para notificaciones;
- su última ubicación está a `radio_actual_m` o menos del punto del caso
  (`ST_DWithin` sobre `geography`);
- esa ubicación tiene menos de 72 h;
- no son quien denunció;
- no están suspendidas.

El punto del caso es la latitud y longitud que quien denuncia marca en el formulario como lugar
del último avistamiento.

**Frente a la fórmula de la tesis**, r = mín(r₀ + v·t, percentil de la categoría, tope del
nivel, tope absoluto):

- **No existen en el código:**
  - r₀ = 300 m;
  - v = 2 km/h;
  - el percentil por categoría;
  - el tope absoluto.
- **Los 2 000 y 1 000 m sí existen,** pero como **valores fijos**, no como topes de un mínimo.

### B2. Nivel «corroborado» y valores del nivel de confianza

**No existe un nivel «corroborado» ni ningún mecanismo para corroborar un caso o ampliar su
radio.** `NivelConfianza` (`denuncias/domain/estados.ts:24`) toma dos valores:

- `REGISTRADA`: creada, visible solo para su autor. No se difunde.
- `PROVISIONAL`: firmada la declaración jurada. Se difunde. La app la llama «Difundida».

La única transición posible es de `REGISTRADA` a `PROVISIONAL`, una sola vez
(`TRANSICIONES_NIVEL` en el mismo archivo). La base lo refuerza con la restricción
`chk_denuncias_nivel_confianza`, que solo admite esos dos valores.

### B3. Historial de git

**El modelo con desplazamiento, percentil y topes nunca estuvo implementado.** Se buscó en todo
el historial (55 commits de todas las ramas):

| Término buscado | Dónde apareció |
|---|---|
| `percentil` | Solo como `percentile_cont`, en consultas de métricas (medianas de latencia) |
| `velocidad`, `km/h` | Nunca |
| `calcularRadio`, `radioInicial`, `topeAbsoluto`, `limitante` | Nunca |
| `RadiusCalculator` | Solo en el diagrama de arquitectura del informe, no en el código. Se señaló el 18 de septiembre |

**De dónde viene el modelo.** En las notas de las sesiones de desarrollo figura la
«especificación v2 del radio por comportamiento». Se aprobó en lo conceptual, con densidad
fuera del cálculo y cuatro cotas superiores, y quedaron cuatro decisiones abiertas antes de
implementarla:

1. `tope_absoluto_m` no tenía valor. Si quedaba por debajo de 10 000, el tope del nivel
   corroborado nunca se alcanzaba.
2. r₀ = 300 m es menor que el error de la rejilla de ubicaciones, de unos 767 m.
3. El percentil 25 que daba a `REGISTRADA` es inalcanzable, porque una denuncia en ese nivel
   no se difunde.
4. Faltaba decidir qué pasaba con `radio_actual_m` si el radio lo decidía el trabajador al
   emitir.

El 1 de octubre Diego confirmó que el radio por comportamiento queda como trabajo futuro. La
especificación no está en el repositorio. La tarea T30 tampoco aparece: las historias del plan
se numeran H1.1 a H8.x.

**La ampliación por corroboración sí existió.** Con esta secuencia:

| Fecha | Commit | Qué pasó |
|---|---|---|
| 2026-09-01 | `3b3aa19` | Aparecen `radioCorroboradoM` = 10 000 m y `caducidadCorroboradaH` = 168 h (7 días). Corroboraba un tercero con su firma (`corroboradoresNecesarios` = 1) |
| 2026-09-03 | `2ad80ae` (H3.5) | Ruta `POST /denuncias/:id/corroborar`: otra persona firmaba como testigo |
| 2026-10-01 | `7968320` | Se quita la corroboración por otra persona. Queda como única vía el número de caso de la FELCC |
| 2026-10-04 | migración `1791145103697-SinFelccYProlongaciones`, en el commit `6fdca8a` del 2026-10-08 | Se quitan el nivel `CORROBORADA` y el número de caso de la FELCC. Las denuncias corroboradas pasan a `PROVISIONAL`. Se agregan las prolongaciones |

**Por qué se quitó la corroboración por otra persona** (`7968320`): «dos personas de acuerdo
podían respaldar una denuncia falsa».

**Al corroborar, el sistema hacía tres cosas:**

- pasaba el radio a 10 km;
- reiniciaba el plazo a 7 días;
- encolaba una emisión nueva con motivo `corroboracion`.

**Por qué se quitó el nivel corroborado.** Lo dicen `denuncias/domain/estados.ts:17-22` y la
migración: el número de caso de la FELCC no es público, así que el sistema no podía
comprobarlo, y un número inventado:

- daba más alcance;
- saltaba el límite de alertas;
- borraba el efecto de una falta.

El motivo `corroboracion` sigue en el tipo `MotivoEmision`
(`alertas/entities/emision-alerta.entity.ts:14-19`), solo como historia de las emisiones
viejas. En la beta no hay ninguna.

### B4. Qué guarda la tabla de emisiones sobre el radio

**Solo el radio aplicado.** `emisiones_alerta.radio_m` (`emision-alerta.entity.ts:68`) es el
radio vigente al emitir. Es nulo en el aviso directo a la persona reportada.

No hay ninguna columna con:

- los valores que determinaron el radio;
- la restricción que lo limitó.

La afirmación de la tesis de que «cada emisión guarda los valores que determinaron el radio y
cuál restricción fue la que lo limitó» **no corresponde al código**.

**Lo que sí se guarda, relacionado con el radio:**

| Dato | Dónde | Qué es |
|---|---|---|
| Destinatarios | `emisiones_alerta.destinatarios` | Cuántos devolvió la consulta espacial |
| Distancia de cada destinatario | `entregas_alerta.distancia_m` (`entrega-alerta.entity.ts:82`) | La distancia al emitir, por dispositivo |
| Radio de la denuncia | `denuncias.radio_actual_m` | El radio vigente de la denuncia |
| Vínculo declarado | `declaraciones_juradas.vinculo_declarado` | Permite deducir cuál de las dos reglas se aplicó |

El vínculo no alcanza para reconstruir el valor exacto: el valor de la configuración en ese
momento no se guarda, y se puede cambiar por variable de entorno.

**Un detalle de implementación.** La consulta de destinatarios usa el radio de la denuncia
(`denuncia.radio_actual_m`, `alertas.service.ts:224`), no el `radio_m` de la emisión. Hoy dan
lo mismo, porque el radio no cambia después de firmar. Si el radio pasara a ser dinámico,
habría que decidir cuál de los dos manda.

### B5. Hora del último avistamiento

**Sí, se guarda:** `denuncias.ultimo_avistamiento_en`, una fecha y hora
(`denuncia.entity.ts:233-234`).

**Dónde aparece:**

- Es obligatoria en el formulario: `@IsDateString` en `create-denuncia.dto.ts:121`.
- El servidor rechaza una fecha futura (`denuncias.service.ts:53`).
- Una restricción de la base exige que no sea anterior a la fecha de nacimiento.
- Forma parte del contenido sellado que se firma (`denuncias/domain/contenido-sellado.ts:60`).
- Se muestra en la ficha pública: «Vista por última vez el…»
  (`denuncias/ficha-publica.ts:180`).

**No interviene en ningún cálculo:**

- ni en el radio;
- ni en la caducidad: `expira_en` se cuenta desde la firma;
- ni en la selección de destinatarios;
- ni en la minoría de edad, que se mide contra la fecha actual (`minoria-edad.ts:45`).

### B6. Prolongar una alerta

**No cambia el radio.** `FirmasService.prolongar` (`firmas.service.ts:416`) hace solo esto:

- inserta una fila firmada en `prolongaciones`;
- actualiza tres campos de la denuncia (líneas 515-519):
  - `estado` vuelve a `ACTIVA`;
  - `expira_en` pasa a ser ahora más 24 h, o 12 h si quien firmó no es familiar;
  - sube el contador `prolongaciones`.

Además:

- no toca `radio_actual_m`;
- no encola ninguna emisión, así que nadie recibe otra notificación;
- el tope es de 3 prolongaciones.

---

## 4. C: datos de la prueba beta

Todas las consultas fueron de solo lectura y de agregados. Corrieron en transacciones
`READ ONLY`, sin nombres, correos, carnets, ubicaciones ni identificadores.

### Qué hay hoy en el servidor (2026-11-02, 18:10)

**No hay ningún simulacro registrado.** Hay una sola emisión en toda la beta:

| Dato | Valor |
|---|---|
| Fecha y hora de la firma | 2026-10-28, 18:23:56 (hora de Bolivia) |
| Radio aplicado | 2 000 m |
| Destinatarios determinados | 0 |
| Entregas registradas | 0 |
| Recibos de la pasarela | 0 |
| Latencia de la firma a la emisión | 24,7 s |
| Usos del canal de avistamiento en las 6 h siguientes | 0 llamadas, 0 mensajes |

Esa denuncia está hoy caducada.

**Contexto de la beta:**

- 10 cuentas, 3 con documento registrado.
- 8 dispositivos registrados para notificaciones, todos Android: 1 el 28 de octubre y 7 el 29.
  Los 8 tuvieron actividad en los últimos 7 días.
- **Solo 1 de las 10 cuentas tiene una ubicación de las últimas 72 h.** Ninguna de las últimas
  24 h, y 2 nunca informaron ubicación.

**Lo que esto significa para los simulacros.** La alerta solo alcanza a quien tiene una
ubicación de las últimas 72 horas dentro del radio. La app informa su ubicación solo al abrirse
o al volver al primer plano, porque no pide la ubicación en segundo plano.

**Un simulacro lanzado hoy no le llegaría a casi nadie.** Antes de cada uno, conviene pedir a
quienes prueban que abran la app en la zona del simulacro un rato antes. Así su ubicación queda
dentro del radio y de las 72 h.

### Tabla por simulacro

Se llena cuando Diego indique las fechas y horas de S1, S2 y S3, o los casos. La consulta está
en el anexo y ya se probó contra el servidor.

| Dato | S1 | S2 | S3 |
|---|---|---|---|
| Fecha y hora de la firma | [COMPLETAR] | [COMPLETAR] | [COMPLETAR] |
| Radio aplicado | | | |
| Destinatarios determinados | | | |
| Entregas registradas | | | |
| Recibos correctos / con error (tipo) | | | |
| Latencia de la firma al recibo: mediana / máxima | | | |
| Usos del canal de avistamiento en 6 h: llamadas / mensajes | | | |

**Cómo leer la latencia.** «El recibo» de la pasarela no es la llegada al teléfono, y no es
rápido por diseño.

1. **De la firma a la emisión** (`emitida_en`): cuánto tardó el trabajador en tomarla. Lo
   revisa cada minuto.
2. **De la firma a la aceptación de Expo** (`entregas_alerta.actualizada_en`): es la latencia
   de envío del sistema.
3. **De la firma al recibo** (`recibo_en`):
   - es cuando el servidor consultó el recibo;
   - el servidor espera 15 minutos después de enviar, y consulta cada 5;
   - por eso esta cifra queda entre 15 y 20 minutos y no mide la entrega;
   - el recibo dice si Apple o Google tomaron la notificación.
4. **La llegada al teléfono no la registra nadie.** Si la tesis la necesita, quienes prueban
   tienen que anotar a mano la hora en que les llegó.

**Dispositivos por versión de Android: el dato no existe.** La tabla `dispositivos` guarda la
plataforma (`android` o `ios`), el token y la última actividad, pero no la versión del sistema.
Solo se puede contar por plataforma, como arriba. No se estimó.

---

## 5. Defectos encontrados en el camino

| Fecha | Qué fallaba | Cómo se detectó | Qué se cambió |
|---|---|---|---|
| 2026-11-02 | `GET /api/users/profile/me` devolvía un texto fijo y nadie la llamaba | Inventario de rutas del encargo anterior | Ruta y controlador eliminados (D1) |
| 2026-11-02 | El `README.md` listaba rutas inexistentes: `GET` y `PUT /api/users/:id`, y `POST /api/auth/verify-identity`, esta última con el vocabulario de «verificación de identidad» | Al confirmar que nadie llamaba a la ruta de D1 | Lista de rutas corregida |
| 2026-11-02 | Dos comentarios describen un radio que cambia durante la vida del caso. Desde el 2026-10-04 el radio es fijo y solo cambia el plazo: `alertas.service.ts:190-192` («cambia al corroborarse») y `denuncias.config.ts:7` («el radio y el plazo cambian») | Al responder B | **Sin cambiar**: B es de solo lectura. Son dos comentarios, sin efecto en el comportamiento |
| 2026-11-02 | El apartado 4.4.2 de la tesis describe un modelo de radio y un registro de sus valores que el código no tiene | Al responder B | **Sin cambiar**: Diego decide si se ajusta la tesis o el código |
| 2026-11-02 | La tabla de entorno decía macOS 26.6. El equipo tiene macOS 27.2 | Al responder A4 | Corregido en A4 |

---

## 6. Lo que tiene que hacer Diego

1. **Decidir B:**
   - Opción 1: ajustar el apartado 4.4.2 al radio fijo por vínculo y llevar el modelo con
     desplazamiento al trabajo futuro.
   - Opción 2: implementarlo, cerrando primero las cuatro decisiones abiertas de B3.
2. **Hacer commit y push de D1** y confirmar el despliegue (D3).
3. **Pasar las fechas y horas de los simulacros**, o los casos, para llenar la tabla de C.
   Antes de cada simulacro, pedir a quienes prueban que abran la app en la zona.
4. **Con el build de D2, que ya compiló:**
   - subirlo a la prueba interna de Play Console;
   - probar en un Android el envío del reporte de avistamiento por WhatsApp;
   - recién entonces pasarlo a la prueba cerrada.

---

## Anexo: consulta de los simulacros

Se ejecuta en el servidor, en una transacción de solo lectura, con las horas de Bolivia:

```bash
ssh oracle 'cd ~/alertas/deploy && sudo docker compose exec -T db sh -c '"'"'PGOPTIONS="-c default_transaction_read_only=on" psql -X -q -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -v desde="2026-11-05 10:00" -v hasta="2026-11-05 12:00"'"'"'' < simulacro.sql
```

```sql
-- Datos de los simulacros: solo lectura y solo agregados.
BEGIN TRANSACTION READ ONLY;
SET LOCAL TIME ZONE 'America/La_Paz';

\echo '== Por emisión'
WITH s AS (
  SELECT row_number() OVER (ORDER BY em.creada_en) AS n,
         em.id, em.denuncia_id, em.creada_en, em.emitida_en, em.radio_m, em.destinatarios,
         (SELECT min(dj.firmada_en) FROM declaraciones_juradas dj
           WHERE dj.denuncia_id = em.denuncia_id AND dj.tipo = 'original') AS firmada_en
  FROM emisiones_alerta em
  WHERE em.motivo = 'firma'
    AND em.creada_en >= (:'desde')::timestamptz
    AND em.creada_en <  (:'hasta')::timestamptz
)
SELECT s.n,
       to_char(s.firmada_en, 'YYYY-MM-DD HH24:MI:SS') AS firma,
       s.radio_m,
       s.destinatarios,
       count(e.id) AS entregas,
       count(e.id) FILTER (WHERE e.estado = 'despachada') AS recibo_ok,
       count(e.id) FILTER (WHERE e.estado = 'no_despachada') AS recibo_con_error,
       count(e.id) FILTER (WHERE e.estado = 'fallida') AS rechazada_al_enviar,
       count(e.id) FILTER (WHERE e.estado = 'sin_recibo') AS sin_recibo,
       count(e.id) FILTER (WHERE e.estado IN ('encolada', 'aceptada')) AS en_curso,
       round(extract(epoch FROM s.emitida_en - s.firmada_en)::numeric, 1) AS s_firma_a_emision,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM e.actualizada_en - s.firmada_en))
             FILTER (WHERE e.ticket_id IS NOT NULL)::numeric, 1) AS s_aceptada_mediana,
       round(max(extract(epoch FROM e.actualizada_en - s.firmada_en))
             FILTER (WHERE e.ticket_id IS NOT NULL)::numeric, 1) AS s_aceptada_max,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM e.recibo_en - s.firmada_en))
             FILTER (WHERE e.estado IN ('despachada', 'no_despachada'))::numeric, 1) AS s_recibo_mediana,
       round(max(extract(epoch FROM e.recibo_en - s.firmada_en))
             FILTER (WHERE e.estado IN ('despachada', 'no_despachada'))::numeric, 1) AS s_recibo_max
FROM s
LEFT JOIN entregas_alerta e ON e.emision_id = s.id
GROUP BY s.n, s.firmada_en, s.emitida_en, s.radio_m, s.destinatarios
ORDER BY s.n;

-- Las dos consultas siguientes repiten el mismo WITH s AS (...).
-- Tipos de error: solo el código, nunca el mensaje, que puede traer el token del teléfono.
--   SELECT s.n, e.estado,
--          split_part(coalesce(e.resultado_recibo, e.resultado_pasarela, 'sin detalle'), ':', 1) AS codigo,
--          count(*)
--   FROM s JOIN entregas_alerta e ON e.emision_id = s.id
--   WHERE e.estado IN ('no_despachada', 'fallida', 'sin_recibo')
--   GROUP BY 1, 2, 3;
-- Usos del canal de avistamiento en las 6 horas siguientes a la firma:
--   SELECT s.n,
--          count(u.id) FILTER (WHERE u.canal = 'LLAMADA') AS llamadas,
--          count(u.id) FILTER (WHERE u.canal = 'MENSAJE') AS mensajes
--   FROM s LEFT JOIN usos_canal_avistamiento u
--          ON u.denuncia_id = s.denuncia_id
--         AND u.creado_en >= date_trunc('minute', s.firmada_en)
--         AND u.creado_en <  s.firmada_en + interval '6 hours'
--   GROUP BY s.n;
ROLLBACK;
```
