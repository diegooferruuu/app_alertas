# Guía de la prueba de campo controlada

**Qué se comprueba:** que una alerta firmada llega a los teléfonos que están dentro del radio
y a ninguno de los que están fuera, y cuánto tarda.

**Duración:** menos de 1 hora en el lugar, con 4 teléfonos y 3 emisiones, más la preparación
del día anterior.

**Quiénes participan:**

- **Diego (coordinador):** lleva el teléfono **E**, el que firma, y la computadora con las
  consultas.
- **4 personas,** una por teléfono:
  - **T1 y T2:** dentro, a menos de 1 km del centro de la zona;
  - **T3 y T4:** fuera, a más de 3,5 km del centro.

## Datos fijos de la prueba

| Dato | Valor |
|---|---|
| Servidor | `https://alertatemprana.download` (el de la beta) |
| App | La de Google Play, de la prueba cerrada |
| Cuenta que firma | `revisor@alertatemprana.test`. Tiene registrado un documento ficticio de 12 cifras |
| Contraseña de esa cuenta | La lees tú con `ssh oracle 'cat ~/revisores-play.txt'`. No la pases por chat ni al repositorio |
| Nombre que se escribe al firmar | `Revisor Google Play` |
| Cuentas de los teléfonos T | `campo1@alertatemprana.test` a `campo4@alertatemprana.test` |
| Vínculo al firmar | **Hermano o hermana**: radio de 2 km y alerta de 24 h |
| Casos ficticios | `SIMULACRO 1 Persona de Ejemplo`, carnet `0009001`<br>`SIMULACRO 2 Persona de Ejemplo`, carnet `0009002`<br>`SIMULACRO 3 Persona de Ejemplo`, carnet `0009003` |
| Foto de los casos | La silueta rotulada «EJEMPLO»: `deploy/muestra/persona-de-ejemplo.jpg` |

**Por qué los carnets empiezan con ceros.** Ningún carnet real empieza así, así que ninguna
cuenta puede coincidir. Eso tiene dos efectos:

- nadie recibe el aviso de «te reportaron»;
- nadie puede declarar falsa la alerta, que es lo único que deja una falta.

Las consultas se corren desde la raíz del repositorio, en la Mac. Las respuestas se guardan en
`~/prueba-de-campo/`, fuera del repositorio:

```bash
mkdir -p ~/prueba-de-campo
```

---

## 1. Preparación del día anterior

### 1.1 Servidor y app

- [ ] El servidor responde. Tiene que decir `{"ok":true}`:
  ```bash
  curl -s https://alertatemprana.download/api/salud
  ```
- [ ] El número de la autoridad es un celular de prueba, no el 110. Tiene que responder `1`.
  El número no se imprime.
  ```bash
  ssh oracle 'grep -cE "^AUTORIDAD_TELEFONO=(\+?591)?[67][0-9]{7}$" ~/alertas/deploy/.env'
  ```
- [ ] Los 5 teléfonos (E y T1–T4) tienen instalada **Alerta Temprana** desde Google Play.
  - Si alguien no está en la prueba cerrada, agrega su Gmail en Play Console → Pruebas →
    Prueba cerrada → Verificadores, y pásale el enlace para unirse.
  - Hazlo el día anterior: Play puede tardar horas en habilitarlo.

### 1.2 Cuentas

- [ ] **Teléfono E:**
  1. Perfil → **Cerrar sesión**, si estabas con tu cuenta.
  2. **Iniciar sesión** con `revisor@alertatemprana.test`.
  3. En Perfil tiene que aparecer **Documento registrado**.
- [ ] **Teléfonos T1 a T4**, uno por uno:
  1. Si hay una sesión abierta: Perfil → **Cerrar sesión**.
  2. **¿No tienes cuenta? Crea una**.
  3. Nombre: `Campo` / `Uno` / `Prueba` (T2: `Dos`, T3: `Tres`, T4: `Cuatro`). Solo letras.
  4. Correo: `campo1@alertatemprana.test` (T2: `campo2@…`, y así).
  5. Teléfono: `70000001` (T2: `70000002`, y así).
  6. Contraseña: la que quieras, que cumpla los requisitos. Anótala en tu hoja, no en el
     repositorio.
  7. Al entrar, acepta los dos permisos:
     - ubicación **«Mientras la app está en uso»**, con la ubicación **precisa**;
     - notificaciones **«Permitir»**.

  No hace falta registrar el documento: para recibir alertas basta con la sesión abierta.
- [ ] Comprueba que los 4 teléfonos tienen dispositivo registrado: en la columna
  `dispositivo` no puede decir `NINGUNO`.
  ```bash
  tools/campo/consultar.sh antes.sql lat=-17.39 lng=-66.15
  ```

### 1.3 El punto del caso y el de cada teléfono

- [ ] **Elige un lugar público para el caso** (una plaza, por ejemplo) y saca su latitud y
  longitud de Google Maps: mantén apretado el punto y copia los números.
- [ ] **Calcula la zona:**
  ```bash
  node tools/campo/zona.mjs <lat> <lng>
  ```
  - Anota el **centro de la zona**: desde ahí se mide todo, no desde el punto marcado.
  - Anota los **límites de la celda**: al marcar el caso en la app, cualquier punto dentro de
    ellos da el mismo centro.
- [ ] **Elige el punto de cada teléfono**, a partir de los ejemplos que imprime `zona.mjs`:
  - lugares públicos y accesibles, al aire libre;
  - T1 y T2 a menos de 1 km del centro;
  - T3 y T4 a más de 3,5 km.
- [ ] **Comprueba las distancias** pasándole los puntos. Ninguno puede decir **BORDE**:
  ```bash
  node tools/campo/zona.mjs <lat> <lng> <latT1,lngT1> <latT2,lngT2> <latT3,lngT3> <latT4,lngT4>
  ```
- [ ] **Completa la tabla de asignación.** El modelo y la versión de Android están en Ajustes →
  Acerca del teléfono.

  | Teléfono | Persona | Modelo y Android | Cuenta | Lugar (lat,lng) | Distancia al centro | Previsto |
  |---|---|---|---|---|---|---|
  | E | Diego | | revisor | — | — | firma |
  | T1 | | | campo1 | | | dentro |
  | T2 | | | campo2 | | | dentro |
  | T3 | | | campo3 | | | fuera |
  | T4 | | | campo4 | | | fuera |

- [ ] **Comprueba que ninguna otra cuenta queda al alcance.** En «Otras cuentas que la alerta
  alcanzaría» tiene que decir `0`. Si dice más, elige otro punto para el caso: no se puede
  saber de quién es esa cuenta.
  ```bash
  tools/campo/consultar.sh antes.sql lat=<centro_lat> lng=<centro_lng>
  ```
- [ ] **Elige además un punto de respaldo,** por si al día siguiente aparece otra cuenta cerca.

### 1.4 Los tres casos ficticios, creados sin firmar

Una denuncia sin firmar no avisa a nadie y solo la ve quien la creó. Crearlas hoy ahorra
10 minutos en el lugar.

- [ ] Guarda la silueta `deploy/muestra/persona-de-ejemplo.jpg` en la galería del teléfono E.
  Por ejemplo, mándatela por WhatsApp y guárdala.
- [ ] En el teléfono E: pestaña **Denuncias cercanas** → **Reportar**. Completa:

  | Campo | Valor |
  |---|---|
  | Nombre de la persona desaparecida | `SIMULACRO 1 Persona de Ejemplo` |
  | Número de carnet | `0009001` |
  | Complemento | (vacío) |
  | Fecha de nacimiento | 10/05/1990: un adulto |
  | Sexo / Estatura / Contextura | Femenino / Entre 1,50 y 1,60 m / Media |
  | Piel / Cabello / Ojos | Trigueña / Negro / Cafés oscuros |
  | Última vez que se la vio | Hoy, una hora antes |
  | Circunstancia | Salió de casa y no volvió |
  | Prenda de arriba y color | Chompa, Azul |
  | Prenda de abajo y color | Pantalón jean, Negro |
  | Fotografía | **Agregar foto** → **Galería** → la silueta |
  | ¿Dónde se la vio por última vez? | **Elegir en el mapa** → toca cerca del centro de la zona → confirma |

- [ ] **Comprueba el punto.** Debajo del mapa la app muestra el punto elegido con 4 decimales.
  Tiene que estar dentro de los límites de la celda que dio `zona.mjs`.
- [ ] **Enviar reporte** → **Sí, denunciar**. Respuesta esperada: «Denuncia registrada.
  Todavía no se difunde».
- [ ] Repite con `SIMULACRO 2`, carnet `0009002`, y con `SIMULACRO 3`, carnet `0009003`, en el
  **mismo punto**.
- [ ] **Comprueba el centro de los casos.** El centro que muestra la sección «Caso» tiene que
  ser el que dio `zona.mjs`, y «Cuenta que firma» tiene que decir `sin_firmar` = 3.
  ```bash
  tools/campo/consultar.sh antes.sql
  ```

### 1.5 Los teléfonos

En los 5 teléfonos:

- [ ] Ajustes → Sistema → Fecha y hora: **hora automática** activada.
- [ ] Sonido activado y sin «No molestar».
- [ ] Ajustes → Apps → Alerta Temprana → Batería: **Sin restricciones**.
  - En Xiaomi, además, «Inicio automático».
  - En Huawei, «Inicio de aplicaciones» en manual.
- [ ] Batería cargada y datos móviles activos.

Para el grupo:

- [ ] Una llamada grupal para la cuenta regresiva de cada firma, de preferencia en otro
  aparato. Si es en el mismo teléfono T, en altavoz.
- [ ] La planilla impresa, `tools/campo/planilla-campo.csv`: una fila por teléfono y emisión.

---

## 2. Antes de cada emisión (unos 5 minutos)

- [ ] Cada persona T está en su punto, al aire libre, y no se mueve hasta terminar la emisión.
- [ ] **Cada persona T actualiza su ubicación:**
  1. Cierra Alerta Temprana desde las apps recientes (deslizarla hacia arriba). Así, al
     abrirla, informa la ubicación de inmediato. Si solo se minimiza y se vuelve antes de
     5 minutos, no informa.
  2. Ábrela y espera en el mapa unos 15 segundos.
  3. Ciérrala otra vez desde las apps recientes.
  4. No uses «Forzar detención» de los ajustes: bloquea las notificaciones.
- [ ] **Diego corre la consulta** y guarda la salida. Cambia `E1` por la emisión que toque:
  ```bash
  tools/campo/consultar.sh antes.sql | tee ~/prueba-de-campo/E1-antes.txt
  ```
- [ ] **Diego comprueba la salida:**
  - En «Caso», el centro es el previsto.
  - En «Teléfonos de prueba», cada fila tiene:
    - `hace_min` de pocos minutos;
    - `posicion` como estaba previsto (`dentro` o `fuera`), nunca `BORDE`;
    - `recibiria` = `SÍ` en T1 y T2, y `no: fuera del radio` en T3 y T4.
  - En «Otras cuentas que la alerta alcanzaría» dice `0`.
  - En «Cuenta que firma», `faltas` = 0 y `difundiendose` es menor que 2.
- [ ] Si algo no cuadra, ve a la sección 8 antes de firmar.

## 3. La emisión

- [ ] En el teléfono E:
  1. Perfil → **Mis denuncias** → el caso que toca (`SIMULACRO 1` en la primera emisión).
  2. **Firmar para difundir**.
  3. En «¿Qué eres de la persona desaparecida?», elige **Hermano o hermana**.
  4. Lee hasta abajo y toca **He leído la declaración**.
  5. En «Escribe tu nombre completo», escribe `Revisor Google Play`.
- [ ] En la llamada, Diego cuenta **«3, 2, 1, ya»** y toca **Firmar declaración jurada** en el
  «ya».
- [ ] Diego anota en la planilla la **hora de la firma**, la de su teléfono. La que cuenta para
  los cálculos es la del servidor, que da `campo.sql`.

## 4. Durante los 2 minutos siguientes

Cada persona T, con Alerta Temprana **cerrada**:

- [ ] Con el «ya», arranca el **cronómetro** de la app Reloj.
- [ ] Cuando aparece la notificación «Persona desaparecida cerca de ti — Se busca a SIMULACRO…»:
  1. Detén el cronómetro.
  2. Anota los segundos en la columna `segundos_cronometro`.
  3. Baja la cortina de notificaciones y saca una **captura de pantalla**, con la notificación
     y la hora visibles.
  4. Anota la hora que muestra la notificación en `hora_visible`.
  5. **No toques la notificación.**
- [ ] Anota `recibio` = `sí` o `no`.
- [ ] **Si a los 2 minutos no llegó:**
  1. Baja la cortina para confirmar que no está.
  2. Anota `no`, deja el cronómetro en blanco y escribe en `observaciones` lo que veas: sin
     datos, «No molestar», etc.
  3. No abras la app todavía.
  4. En T3 y T4 lo esperado es que **no** llegue.

El servidor revisa cada minuto si hay alertas por emitir. Que tarde hasta un minuto es normal.

## 5. Después de cada emisión

- [ ] **Diego cierra la alerta,** para que deje de verse en el mapa y libere el cupo de
  2 alertas a la vez. En el teléfono E: Mis denuncias → el caso → **La encontramos** →
  **Sí, apareció**.
  - Cerrarla así **no deja falta**.
  - Dejarla vencer tampoco dejaría falta, pero la alerta seguiría a la vista 24 horas y
    ocuparía el cupo.
  - La única falta posible es que la persona reportada la declare falsa, y con estos carnets
    no hay ninguna cuenta que pueda hacerlo.
- [ ] Espera a que todos hayan anotado y a que pasen al menos **3 minutos desde la firma**. Así
  el servidor terminó de emitir.
- [ ] La siguiente emisión usa el **caso siguiente**: SIMULACRO 2 y después 3. Una denuncia
  sobre un carnet no se puede repetir mientras siga abierta.
- [ ] Vuelve al paso 2.

## 6. Al terminar

### 6.1 Los datos del servidor

- [ ] Corre `campo.sql` con una ventana que cubra toda la prueba, en hora de Bolivia:
  ```bash
  tools/campo/consultar.sh campo.sql desde="2026-11-08 10:00" hasta="2026-11-08 11:30" | tee ~/prueba-de-campo/campo.txt
  ```
- [ ] Guarda la planilla completada y las capturas de pantalla en `~/prueba-de-campo/`.

### 6.2 Tabla 21: una fila por emisión

| Columna | De dónde sale |
|---|---|
| N.º | `n` de «Por emisión» |
| Fecha y hora | `firma` de «Por emisión»: la hora del servidor |
| Radio | `radio_m`, que tiene que ser 2000 |
| Dentro (recibieron de cuántos) | De la planilla: cuántos teléfonos `dentro` tienen `recibio` = sí, sobre cuántos había. Contrástalo con «Por teléfono»: los que tienen estado `aceptada` o `despachada` |
| Fuera (sin alerta de cuántos) | De la planilla: cuántos teléfonos `fuera` tienen `recibio` = no, sobre cuántos había. En «Por teléfono» tienen que figurar como `sin entrega` |
| Latencia del servidor (mediana) | `s_aceptacion_mediana`: de la firma a la aceptación de la pasarela |
| Latencia percibida (mediana) | La mediana de `segundos_cronometro` de los teléfonos `dentro` que la recibieron (ver 6.4) |

**Comprobación:** `a_otras_cuentas` tiene que ser 0 en todas las emisiones, y `destinatarios`
tiene que ser igual al número de teléfonos dentro.

### 6.3 Anexo 11: una fila por teléfono y emisión

| Columna | De dónde sale |
|---|---|
| Emisión | `n` |
| Teléfono (modelo y Android) | Tabla de asignación (1.3) |
| Posición (dentro o fuera) | `posicion_prevista` de la planilla, confirmada por `posicion` en `E<n>-antes.txt` |
| Distancia (km) | `distancia_m` de «Por teléfono», dividida por 1000. En los que no tienen entrega, usa la de `E<n>-antes.txt`, que es la del momento de la firma |
| Recibió (sí o no) | `recibio` de la planilla |
| Latencia (s) | `segundos_cronometro` de la planilla. En los que no la recibieron, en blanco |

### 6.4 Cómo se calcula la latencia percibida

**La hora de la notificación no sirve sola.** Android la muestra en horas y minutos, sin
segundos. Restarle la hora de la firma da un error de hasta un minuto, del mismo tamaño que la
latencia que se quiere medir.

**Por eso se mide con el cronómetro:**

- la latencia percibida es `segundos_cronometro`: desde el «ya» de Diego hasta que aparece la
  notificación;
- incluye el segundo que tarda la firma en llegar al servidor.

**La hora visible queda como control.** Tiene que ser el mismo minuto que la `firma` del
servidor, o el siguiente.

Ejemplo:

- el servidor firmó a las 10:12:40;
- el cronómetro marcó 38 s;
- la notificación dice 10:13.

Es coherente: 10:12:40 más 38 s son las 10:13:18. La latencia percibida es 38 s.

**Las dos latencias no miden lo mismo:**

| Latencia | Qué mide |
|---|---|
| Del servidor | Hasta que Expo aceptó el mensaje |
| Percibida | Hasta que el teléfono lo mostró |

La diferencia es el tramo de Expo, Google y el teléfono, que nadie más registra.

## 7. Limpieza

- [ ] Las 3 denuncias quedaron **CERRADAS**, con «La encontramos». No se borran: el sistema no
  borra denuncias, quedan como historial. Si alguna quedó sin firmar, ciérrala igual con
  **La encontramos**.
- [ ] **En cada teléfono T:** Perfil → **Cerrar sesión**. Si la persona tenía su propia cuenta,
  que vuelva a iniciar sesión con ella. Así su teléfono vuelve a recibir sus alertas: el
  teléfono queda con la última cuenta que inició sesión en él.
- [ ] **En el teléfono E:** cierra la sesión de revisión y vuelve a la tuya.
- [ ] **No borres** las cuentas `campo1` a `campo4` hasta terminar la tesis: `campo.sql` las
  necesita para volver a sacar los datos.
- [ ] En el servidor no se cambió nada, así que no hay configuración que restaurar.

## 8. Problemas frecuentes

**La notificación no llega a un teléfono que estaba dentro**

1. Mira su fila en «Por teléfono», en `campo.sql`:
   - `sin entrega`: el servidor no lo eligió. Revisa en `E<n>-antes.txt` su `recibiria`: fue
     la ubicación o el dispositivo.
   - `fallida` con `DeviceNotRegistered`: el teléfono cambió de token. Hay que cerrar sesión e
     iniciarla otra vez en la app.
   - `aceptada` o `despachada`: el servidor la entregó a Expo. El problema está en el
     teléfono.
2. **En el teléfono, revisa:**
   - Ajustes → Apps → Alerta Temprana → Notificaciones: permitidas, también la categoría
     «Alertas de desaparición»;
   - sin «No molestar» ni ahorro de batería;
   - que no se haya usado «Forzar detención»;
   - que tenga datos móviles.
3. **No vuelvas a firmar el mismo caso.** Anota `no`, sigue con la emisión siguiente y
   diagnostica al final.

**La ubicación no se actualizó** (`hace_min` alto, o `SIN UBICACIÓN`)

1. Cierra la app desde las apps recientes y vuelve a abrirla. Si solo se minimizó, no informa
   hasta pasados 5 minutos.
2. Ajustes → Apps → Alerta Temprana → Permisos → Ubicación: «Mientras la app está en uso», con
   la ubicación precisa activada.
3. GPS encendido y al aire libre unos 30 segundos.
4. Corre otra vez `antes.sql`.

**La cuenta que firma quedó restringida**

- Con estos carnets no puede pasar por faltas: no hay ninguna cuenta que pueda declarar falsa
  la alerta, y ni vencer ni «La encontramos» dejan falta.
- **`LIMITE_ALERTAS_PROVISIONALES`:** hay 2 alertas difundiéndose. Cierra con
  **La encontramos** la anterior.
- **`DENUNCIA_ABIERTA_SOBRE_PERSONA`:** se repitió un carnet que sigue abierto. Usa el caso
  siguiente.
- **`faltas` mayor que 0** en `antes.sql`: alguien declaró falsa una alerta. Detén la prueba:
  las faltas no se borran y la cuenta queda 7 días sin firmar.

**Un teléfono quedó en el borde** (`BORDE` en `antes.sql`)

- No firmes así.
- Si estaba previsto dentro, acércalo a menos de 1 km del centro. Si estaba previsto fuera,
  aléjalo a más de 3,5 km.
- Después repite el paso 2: cerrar, abrir y cerrar la app en el punto nuevo, y correr
  `antes.sql` otra vez.

**Aparece otra cuenta al alcance** («Otras cuentas» mayor que 0)

- Otra persona con la app está a menos de 2 km del centro y la abrió en las últimas 72 horas.
- No firmes: le llegaría la alerta.
- Pasa al punto de respaldo. Ahí hay que crear los casos de nuevo, porque la ubicación de una
  denuncia no se puede editar. Cierra antes con **La encontramos** las tres del punto
  anterior.

## Cronograma de referencia

| Tramo | Minutos |
|---|---|
| Llegada a los puntos y prueba de la llamada | 10 |
| Emisión 1: pasos 2 a 5 | 10 |
| Emisión 2 | 10 |
| Emisión 3 | 10 |
| `campo.sql` y revisión de la planilla | 5 |
| **Total** | **45** |
