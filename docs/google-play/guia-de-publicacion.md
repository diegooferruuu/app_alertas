# Publicar Alerta Temprana en Google Play

Cuenta **personal** de desarrollador, creada en octubre de 2026. Para estas cuentas Google
exige una prueba cerrada antes de abrir la app al público:

| Etapa | Qué pide | Cuánto tarda |
|---|---|---|
| 1. Prueba interna | Subir el `.aab` y una lista de correos (hasta 100) | Minutos, sin revisión |
| 2. Prueba cerrada | «Contenido de la app» completo, **12 testers o más durante 14 días seguidos** | Revisión de Google (~1–3 días) + 14 días |
| 3. Producción | Pedir acceso desde el Panel y responder tres bloques de preguntas | ~7 días de revisión |

Un tester que se sale antes de los 14 días no cuenta. Conviene invitar a 15 o más.

Paquete: `download.alertatemprana` (el dominio al revés). Una vez subido, no se puede cambiar.

---

## 1. Crear la app

En Play Console, toca **Crear app** y completa:

- **Nombre:** Alerta Temprana
- **Idioma predeterminado:** Español (Latinoamérica), es-419
- **Tipo:** App
- **Precio:** Gratis
- Acepta las dos declaraciones: las políticas para desarrolladores y las leyes de exportación de EE. UU.

## 2. Prueba interna (el primer `.aab`)

1. Ve a **Probar y publicar → Pruebas → Prueba interna → Crear versión**.
2. Acepta **Firma de apps de Google Play**: Google guarda la clave de firma y la de EAS pasa a ser la de subida.
3. Sube el `.aab` que compila EAS con `npx eas-cli@latest build --platform android --profile production`. La primera vez se sube a mano; después puede hacerlo `eas submit`.
4. En **Testers**, crea una lista de correos y copia el **enlace para unirse**. Cada tester lo abre en su teléfono, acepta y descarga la app desde Play.

### En cuanto subas el primer `.aab`: el mapa

Google vuelve a firmar la app con su propia clave. Con la restricción actual, la clave de Google Maps
solo acepta la firma de EAS, así que en la versión instalada desde Play el mapa saldría gris.

1. Ve a **Probar y publicar → Integridad de la app**. En la sección **Firma de apps de Play**, toca **Configuración**. Si no lo encuentras en el menú, escribe «firma de apps» en el buscador de arriba de Play Console. Esta sección aparece recién cuando la versión con el `.aab` queda guardada.
2. En **Certificado de la clave de firma de apps** (no el de la clave de subida), copia la **huella digital del certificado SHA-1**.
3. En Google Cloud, entra a **APIs y servicios → Credenciales** y abre la clave de Maps.
4. En **Restricciones de aplicaciones**, agrega `download.alertatemprana` con ese SHA-1. No borres el de EAS: el APK de `preview` lo sigue usando.

---

## 3. Contenido de la app

Está en **Política → Contenido de la app**. Toda esta sección es obligatoria para la prueba cerrada.

### Política de privacidad
```
https://alertatemprana.download/privacidad
```

### Acceso a la app
Elige **«Todas o algunas funciones están restringidas»** y agrega una instrucción con la cuenta de
revisión. Se crea una sola vez en el servidor, y su contraseña se genera ahí y **no está en el
repositorio**:

```bash
ssh oracle '~/alertas/deploy/crear-cuenta-revision.sh'
```

Después, léela con:

```bash
ssh oracle 'cat ~/revisores-play.txt'
```

Texto de la instrucción, en inglés porque así trabajan los revisores. El campo admite 500 caracteres y este tiene 499:

```
Log in with the credentials above. The account has an ID document registered, so all features are enabled (registering one needs a Bolivian ID card). Alerts reach people within 1-2 km in Bolivia, so the map may be empty; the "Denuncias" tab lists all recent alerts. Create one: Mapa > + Reportar. Signing needs a screen lock; type the name "Revisor Google Play". Delete account: Perfil > Eliminar mi cuenta. Report content: Denuncias > "Persona de Ejemplo" (sample) > Reportar contenido inapropiado.
```

#### La alerta de muestra

«Reportar contenido inapropiado» solo aparece en la alerta de **otra** cuenta. Si el servidor
no tiene ninguna, el revisor no encuentra el sistema de reportes y puede rechazar la app por la
política de contenido generado por usuarios. Antes de mandar la app a revisión, deja una a la vista:

```bash
ssh oracle '~/alertas/deploy/alerta-de-muestra.sh'
```

- **La cuenta que la presenta no pasa por el OCR.** Nace con el documento ya registrado, como la de
  revisión. Su contraseña es inutilizable y no se guarda en ningún lado, así que nadie puede entrar con ella.
- **La alerta se ve como lo que es.** La persona se llama «Persona de Ejemplo» y la foto es una
  silueta con la palabra EJEMPLO.
- **No le llega a nadie.** La zona está en medio del Salar de Uyuni: la única notificación, la de
  la firma, no encuentra a nadie. La lista «Denuncias» no filtra por distancia, así que el revisor
  la ve desde donde esté.
- **Vence a las 24 horas, como cualquier alerta.** Si el guion se corre de nuevo y le quedan menos
  de 12 horas, la prolonga sin notificar. Cuando se acaban las prolongaciones, la da por encontrada
  y presenta otra.

Una revisión puede durar varios días. Para que la alerta no venza mientras tanto, instala esta
tarea, que corre el guion cada 6 horas:

```bash
ssh oracle '(crontab -l 2>/dev/null; echo "0 */6 * * * \$HOME/alertas/deploy/alerta-de-muestra.sh >> \$HOME/alerta-de-muestra.log 2>&1") | crontab -'
```

Para quitarla cuando la app ya esté aprobada:

```bash
ssh oracle 'crontab -l | grep -v alerta-de-muestra | crontab -'
```

Si el revisor la reporta, te llega el correo del reporte como cualquier otro. No hace falta ocultarla.

### Anuncios
No, la app no tiene anuncios.

### Clasificación del contenido
Elige la categoría **«Todas las demás apps»**. Las respuestas que importan son estas:

- Violencia, sexo, lenguaje soez, drogas, apuestas: **No** en todas.
- ¿Los usuarios pueden interactuar o intercambiar contenido? **Sí.** Las alertas, con su foto, las ven otros usuarios.
- ¿Comparte información personal del usuario con terceros? **Sí.** Es la constancia: la persona reportada puede recibir el nombre de quien firmó la declaración jurada.
- ¿Comparte la ubicación física actual del usuario con otros usuarios? **No.** La zona de la alerta es la del último avistamiento de la persona buscada, no la de nadie que use la app.
- ¿Permite comprar productos digitales? **No.**

### Público objetivo
**18 años o más**, únicamente. La app no está diseñada para niños.

### Apps de noticias
No.

### Apps gubernamentales
**No.** No es una app de ninguna entidad del Estado, y la descripción lo aclara.

### Funciones financieras / Salud
No / No.

### Seguridad de los datos

Respuestas generales:

| Pregunta | Respuesta |
|---|---|
| ¿Recopila o comparte datos del usuario? | Sí |
| ¿Están cifrados en tránsito? | Sí (HTTPS) |
| ¿Ofrece una forma de solicitar la eliminación? | Sí, con este enlace: `https://alertatemprana.download/eliminar-cuenta` |

**Compartido:** solo el **Nombre**. Es el de quien firma una declaración jurada, que puede
recibir la persona reportada en la constancia. Márcalo con el propósito «Prevención de fraudes,
seguridad y cumplimiento». Declararlo de más no se sanciona; callarlo, sí.

Google no cuenta como «compartir» lo que reciben los proveedores que hacen funcionar el servicio,
como Expo, FCM u Oracle. Tampoco cuenta lo que el propio usuario publica a sabiendas, como una
alerta. Por eso el resto queda en **No compartido**.

Datos que se marcan como **recopilados**:

| Tipo de dato (en Play) | Qué es en la app | Obligatorio | Para qué |
|---|---|---|---|
| Ubicación → **Ubicación precisa** | Última ubicación, para saber quién está en el radio | Opcional: sin ella no llegan alertas | Funcionalidad de la app |
| Información personal → **Nombre** | Nombre de la cuenta y de la persona buscada (**compartido**: ver arriba) | Sí | Funcionalidad, administración de la cuenta, prevención de fraude |
| Información personal → **Dirección de correo** | Inicio de sesión | Sí | Administración de la cuenta |
| Información personal → **Números de teléfono** | Dato de la cuenta | Sí | Administración de la cuenta |
| Información personal → **ID de usuario** | Identificador interno de la cuenta | Sí | Funcionalidad, prevención de fraude |
| Información personal → **Otra información** | Número de carnet, guardado como hash | Opcional: solo para denunciar | Prevención de fraude, seguridad y cumplimiento |
| Fotos y videos → **Fotos** | Foto de la persona buscada (guardada). Carnet y selfie (**se procesan y se descartan**) | Opcional | Funcionalidad, prevención de fraude |
| Actividad en la app → **Otro contenido generado por el usuario** | Denuncias, declaraciones juradas, reportes de contenido | Opcional | Funcionalidad, prevención de fraude |
| Identificadores del dispositivo → **ID del dispositivo u otros** | Token de notificaciones | Sí | Funcionalidad de la app |

La foto del carnet y la selfie se procesan de forma efímera, pero la foto de la persona buscada sí
se guarda. Por eso **Fotos** no se marca como «solo efímero».

No se recopilan mensajes: el reporte de avistamiento no pasa por el servidor. Tampoco hay
analítica ni datos de salud.

### Permisos
No hace falta ninguna declaración. La app no usa ubicación en segundo plano, ni acceso a fotos y
videos (`READ_MEDIA_*`), ni servicios en primer plano. El almacenamiento solo se pide hasta
Android 12.

---

## 4. Ficha de Play Store

### Descripción breve (80 caracteres)
```
Avisa a quienes están cerca cuando desaparece una persona y ayuda a encontrarla.
```

### Descripción completa
```
Alerta Temprana ayuda a encontrar a personas desaparecidas avisando, en las primeras horas, a quienes están cerca del lugar donde se las vio por última vez.

CÓMO FUNCIONA
• Quien denuncia una desaparición registra a la persona buscada: nombre, descripción física, vestimenta y una foto si es mayor de edad.
• Para difundir la alerta firma una declaración jurada desde su teléfono. Cada denuncia queda atribuida a una identidad registrada: es lo que desalienta las denuncias falsas.
• La app avisa con una notificación a quienes están a 1 o 2 km de la zona, y muestra la alerta en el mapa.
• Si ves a la persona, la app arma un reporte con la hora y la zona para que lo envíes tú a la Policía, por llamada o mensaje. Lo que escribes no pasa por nuestro servidor.

SI LA ALERTA ES SOBRE TI
• Si tu carnet está registrado y alguien te denuncia, recibes un aviso y puedes retirar la alerta: «Estoy bien» o «Esta denuncia es falsa».
• Una denuncia declarada falsa deja una falta a quien la presentó, con suspensiones automáticas.
• Nadie ve quién presentó una denuncia.

PRIVACIDAD
• La foto de tu carnet y tu selfie se usan solo para registrar tu documento y no se guardan.
• Del último avistamiento se guarda una zona de alrededor de 1 km, nunca el punto exacto.
• Puedes eliminar tu cuenta desde la app.

Alerta Temprana es un proyecto académico. No es una aplicación oficial de la Policía ni de ninguna entidad del Estado, y no reemplaza la denuncia ante la FELCC: hazla también.
```

### Gráficos

| Elemento | Archivo |
|---|---|
| Ícono (512 × 512) | `docs/google-play/icono-512.png` |
| Gráfico de funciones (1024 × 500) | `docs/google-play/grafico-de-funciones.png` |
| Capturas de teléfono (2 a 8) | Tómalas en tu entorno local con los datos de demostración: el mapa, la lista, el detalle de una alerta y el reporte de avistamiento |

En las capturas no pueden aparecer datos de personas reales. Los datos de demostración no están en
el servidor, y `tools/datos-demo.sh` no se corre ahí: su contraseña está en el repositorio y
desactiva por un momento las protecciones de solo inserción. Para las capturas:

1. Levanta el backend local y corre `./tools/datos-demo.sh`.
2. Corre `./tools/red-demo.sh`, sin `beta`, para que Metro apunte a tu Mac.
3. Abre la app desde Metro, entra con una de las cuentas `@demo.bo` y toma las capturas.

### Categoría y contacto
- **Categoría:** Social.
- **Correo de contacto:** `dferrufinoc@gmail.com`.
- **Sitio web:** puede quedar vacío.

---

## 5. Prueba cerrada (los 14 días)

1. Ve a **Pruebas → Prueba cerrada**, crea una pista y elige **Bolivia** como país.
2. Agrega los testers con una lista de correos o un Grupo de Google. Necesitas 12 como mínimo; invita a 15 o más.
3. Promueve a esa pista la versión de la prueba interna y envíala a revisión.
4. Cuando Google la aprueba, cada tester se une con el enlace y **mantiene la app instalada 14 días seguidos**. Conviene que la abran de vez en cuando: Google mira que la prueba sea real.
5. Al día 14, en el **Panel**, toca **Solicitar acceso a producción** y responde sobre la prueba, la app y si está lista.

---

## Lo que atiende quien opera el servidor

- **Pedidos de eliminación por correo:** primero comprueba que el mensaje llegó *desde* el correo de la cuenta. Después:
  ```bash
  ssh oracle '~/alertas/deploy/eliminar-cuenta.sh persona@correo.com'
  ```
  Confirma a esa dirección. La página promete un plazo máximo de 30 días.
- **Reportes de contenido:** cada uno llega por correo con el comando listo para ocultar la foto. Este paso no borra nada:
  ```bash
  ssh oracle '~/alertas/deploy/ocultar-contenido.sh <id> "motivo"'
  ```
  Para que lleguen los correos, el `.env` del servidor necesita `SMTP_*`: con Gmail, una contraseña de aplicación. Sin eso, el reporte queda guardado igual, pero no avisa.
