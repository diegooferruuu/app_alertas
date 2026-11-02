# Política de privacidad de Alerta Temprana

> Documento para la tesis. Es el texto que está publicado, generado el 2 de noviembre de 2026
> a partir de su fuente en el código. No se edita aquí: si la política cambia, cambia en el código
> y este archivo se vuelve a generar.

## Cómo se publica

- **URL pública:** https://alertatemprana.download/privacidad. Es la que está declarada en Google
  Play, en Política → Contenido de la app → Política de privacidad.
- **La sirve el propio backend**, fuera del prefijo `/api`, igual que
  https://alertatemprana.download/eliminar-cuenta (cómo eliminar la cuenta sin la app) y
  https://alertatemprana.download/seguridad-infantil (estándares de seguridad infantil).
- **Fuente única:** `apps/backend/src/legal/paginas-legales.ts`, que la ruta `GET /privacidad`
  de `LegalController` devuelve como HTML.

  No hay un archivo HTML aparte publicado con GitHub Pages, y es deliberado. Con dos copias, el
  texto podría dejar de coincidir con lo que hace la app. Así, la política sale del mismo
  repositorio y del mismo despliegue que el código que describe.
- **Pruebas:** `legal.controller.spec.ts` comprueba que la política diga lo que hace el código:
  - que las imágenes del carnet no se guardan;
  - que no se usa la ubicación en segundo plano;
  - que el avistamiento no pasa por el servidor;
  - que lo que se borra y lo que se conserva al eliminar la cuenta coincide, palabra por
    palabra, entre la política y la página de eliminación.
- **Correo de contacto:** dferrufinoc@gmail.com, el de Diego. Sale de la configuración del
  servidor y es el mismo que figura en la ficha de Google Play.
- **Enlaces dentro de la app:** en «Crear cuenta», donde dice «Al crear tu cuenta aceptas la
  política de privacidad», y al pie de «Perfil», junto con «Eliminar mi cuenta».

## Texto publicado

*Vigente desde el 2 de noviembre de 2026.*

Alerta Temprana avisa a las personas que están cerca cuando alguien denuncia la desaparición de una persona, y facilita avisar a la Policía si la ven. Es un proyecto académico desarrollado por Diego Ferrufino, responsable de los datos que se describen aquí. Contacto: dferrufinoc@gmail.com.

### Qué datos guardamos

- **Tu cuenta:** nombres y apellidos, correo, teléfono y tu contraseña, que se guarda solo como hash.
- **Tu carnet de identidad:** para registrar tu documento pedimos una foto del carnet y una selfie. Las procesamos en nuestro servidor para leer el número y el nombre y para comparar tu rostro con el de la foto del carnet, y las descartamos en el mismo momento: no guardamos las imágenes ni ninguna medida de tu rostro. Del carnet guardamos el número solo en forma de hash y el nombre que coincidió.
- **Tu ubicación:** la última ubicación que envía la aplicación mientras la usas, para saber si estás dentro del radio de una alerta. Cada envío reemplaza al anterior. La aplicación no usa tu ubicación en segundo plano.
- **Las denuncias que presentas:** los datos de la persona buscada (nombre, número de carnet en hash, descripción física, vestimenta y una foto si es mayor de edad) y la zona aproximada, de alrededor de 1 km, donde se la vio por última vez. Nunca el punto exacto.
- **Tus declaraciones juradas:** el texto que aceptaste, la frase que escribiste para firmar y la firma de tu teléfono con su clave pública. La clave privada no sale de tu teléfono.
- **Tus teléfonos:** el identificador para enviarte notificaciones y si es Android o iPhone.
- **Los reportes de contenido** que hagas sobre una alerta.

El reporte de un avistamiento **no pasa por nuestro servidor**: tu teléfono lo arma y tú lo entregas a la Policía, en una llamada o por WhatsApp como imagen, con tu nombre, el lugar y la hora que marcaste. Solo registramos, sin saber quién, que se usó un canal para una alerta.

### Para qué los usamos

- Para avisarte de las alertas cercanas y mostrarte el mapa.
- Para que cada denuncia quede atribuida a una identidad: es lo que desalienta las denuncias falsas.
- Para aplicar las sanciones automáticas cuando la persona afectada declara falsa una denuncia.
- Para medir si las alertas llegan, sin usar el contenido de tus mensajes.

No hay publicidad, no vendemos datos y no los usamos para nada más.

### Quién más los ve

- **Las personas cercanas** ven la alerta: los datos de la persona buscada. Nunca ven quién la denunció.
- **Cualquiera con el enlace de una alerta** ve su ficha pública, que tampoco incluye a quien la denunció y deja de mostrarse si la alerta se retira.
- **La persona reportada** en una denuncia firmada puede pedir una constancia con el nombre de quien firmó la declaración jurada, la haya retirado o no. Quien firmó puede pedir la suya, sin los demás nombres. Cada entrega queda registrada.
- **Proveedores que hacen funcionar el servicio:** Expo, Google y Apple reciben el identificador de tu teléfono y el texto de cada notificación (por ejemplo, el nombre de la persona buscada) para entregarla; Google Maps dibuja el mapa de la aplicación; Oracle Cloud aloja el servidor.
- **Las autoridades**, si una orden legal lo exige, o si en una alerta se publica material de abuso sexual infantil: en ese caso lo denunciamos con los datos de la cuenta que lo publicó (ver los [estándares de seguridad infantil](https://alertatemprana.download/seguridad-infantil)).

### Cuánto tiempo y cómo eliminar tu cuenta

Guardamos tus datos mientras tengas la cuenta. Puedes eliminarla cuando quieras desde la aplicación (Perfil → Eliminar mi cuenta) o, sin la aplicación, como se explica en [esta página](https://alertatemprana.download/eliminar-cuenta).

Se borran:

- tu nombre, tu correo, tu teléfono y tu contraseña;
- tu última ubicación y los datos de tus teléfonos para las notificaciones.

Se conserva, porque la denuncia de una desaparición es una declaración jurada y tiene que seguir siendo atribuible, y para que eliminar la cuenta no sirva para evadir una sanción:

- el número de tu carnet, solo en forma de hash (una huella que no permite leerlo);
- las denuncias que presentaste y las declaraciones juradas que firmaste, con el nombre de tu documento si firmaste alguna;
- las faltas que tengas por denuncias que la persona afectada declaró falsas, y, si tu cuenta estaba suspendida, el bloqueo de tu carnet.

Tus alertas activas dejan de difundirse en el momento. Si más adelante vuelves a registrarte con el mismo carnet, recuperas esa cuenta con su historial.

### Seguridad

Toda la comunicación con el servidor va cifrada (HTTPS). Las contraseñas y los números de carnet se guardan como hash, y las declaraciones juradas forman una cadena que permite detectar si alguien alteró una.

### Menores de edad

La aplicación es para mayores de 18 años. Si la persona buscada es menor de edad, su fotografía no se guarda.

### Cambios

Si esta política cambia, la nueva versión se publica en esta misma dirección con su fecha.

*Alerta Temprana · dferrufinoc@gmail.com*
