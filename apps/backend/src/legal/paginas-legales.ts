import { escaparHtml } from '../denuncias/ficha-publica';

/**
 * Las dos páginas públicas que exige Google Play: la política de privacidad y
 * la de eliminación de cuenta, que tiene que funcionar sin la aplicación.
 *
 * Lo que dicen tiene que ser verdad del código, no una plantilla: si cambia lo
 * que se guarda, cambia esto. Cada afirmación remite a lo que la sostiene:
 *  - la foto del carnet y la selfie no se guardan: `VerificationService`;
 *  - el número del carnet solo en hash: `hashDeDocumento`;
 *  - la zona de ~1 km y no el punto: `aZonaDeAvistamiento`;
 *  - el avistamiento no llega al servidor (I2): `usos_canal_avistamiento` solo
 *    guarda el canal, la alerta y el minuto;
 *  - lo que se borra y lo que queda al eliminar: `CuentasService`.
 */

/** Cuándo cambió por última vez lo que dicen estas páginas. */
export const VIGENTE_DESDE = '27 de octubre de 2026';

const ESTILOS = `
  :root { --fondo: #f3f4f6; --hoja: #ffffff; --texto: #16181d; --suave: #5b6270;
          --linea: #e3e5ea; --acento: #b32c24; }
  @media (prefers-color-scheme: dark) {
    :root { --fondo: #111317; --hoja: #1b1e24; --texto: #eef0f4; --suave: #a3a9b6;
            --linea: #2c3039; --acento: #ff7b70; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--fondo); color: var(--texto);
         font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 16px; }
  .hoja { background: var(--hoja); border-radius: 16px; padding: 24px 20px; }
  .rotulo { margin: 0; color: var(--acento); font-size: 13px; font-weight: 700;
            letter-spacing: 0.08em; text-transform: uppercase; }
  h1 { margin: 4px 0 4px; font-size: 28px; line-height: 1.2; text-wrap: balance; }
  .fecha { margin: 0 0 20px; color: var(--suave); font-size: 14px; }
  h2 { margin: 28px 0 8px; font-size: 19px; line-height: 1.3; text-wrap: balance; }
  p, li { max-width: 65ch; }
  ul, ol { padding-left: 22px; }
  li { margin: 4px 0; }
  .paso { padding: 14px 16px; border: 1px solid var(--linea); border-radius: 12px; margin: 12px 0; }
  .paso h2 { margin-top: 0; }
  a { color: var(--acento); }
  footer { margin: 16px 4px 0; color: var(--suave); font-size: 13px; }
`;

const pagina = (titulo: string, cuerpo: string): string =>
  `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(titulo)}</title>
<style>${ESTILOS}</style>
</head>
<body>
<main>
${cuerpo}
</main>
</body>
</html>
`;

const enlaceDeCorreo = (correo: string, asunto?: string): string => {
  const destino = asunto
    ? `mailto:${correo}?subject=${encodeURIComponent(asunto)}`
    : `mailto:${correo}`;
  return `<a href="${escaparHtml(destino)}">${escaparHtml(correo)}</a>`;
};

/** Lo que se borra y lo que queda: es lo mismo en las dos páginas, y no puede decir cosas distintas. */
const queSeBorraYQueQueda = (): string => `<p>Se borran:</p>
<ul>
<li>tu nombre, tu correo, tu teléfono y tu contraseña;</li>
<li>tu última ubicación y los datos de tus teléfonos para las notificaciones.</li>
</ul>
<p>Se conserva, porque la denuncia de una desaparición es una declaración jurada y tiene que seguir siendo atribuible, y para que eliminar la cuenta no sirva para evadir una sanción:</p>
<ul>
<li>el número de tu carnet, solo en forma de hash (una huella que no permite leerlo);</li>
<li>las denuncias que presentaste y las declaraciones juradas que firmaste, con el nombre de tu documento si firmaste alguna;</li>
<li>las faltas que tengas por denuncias que la persona afectada declaró falsas.</li>
</ul>
<p>Tus alertas activas dejan de difundirse en el momento. Si más adelante vuelves a registrarte con el mismo carnet, recuperas esa cuenta con su historial.</p>`;

export const htmlPoliticaDePrivacidad = (correo: string): string =>
  pagina(
    'Política de privacidad · Alerta Temprana',
    `<article class="hoja">
<p class="rotulo">Alerta Temprana</p>
<h1>Política de privacidad</h1>
<p class="fecha">Vigente desde el ${VIGENTE_DESDE}</p>

<p>Alerta Temprana avisa a las personas que están cerca cuando alguien denuncia la desaparición de una persona, y facilita avisar a la Policía si la ven. Es un proyecto académico desarrollado por Diego Ferrufino, responsable de los datos que se describen aquí. Contacto: ${enlaceDeCorreo(correo)}.</p>

<h2>Qué datos guardamos</h2>
<ul>
<li><strong>Tu cuenta:</strong> nombres y apellidos, correo, teléfono y tu contraseña, que se guarda solo como hash.</li>
<li><strong>Tu carnet de identidad:</strong> para registrar tu documento pedimos una foto del carnet y una selfie. Las procesamos en nuestro servidor para leer el número y el nombre y para comparar tu rostro con el de la foto del carnet, y las descartamos en el mismo momento: no guardamos las imágenes ni ninguna medida de tu rostro. Del carnet guardamos el número solo en forma de hash y el nombre que coincidió.</li>
<li><strong>Tu ubicación:</strong> la última ubicación que envía la aplicación mientras la usas, para saber si estás dentro del radio de una alerta. Cada envío reemplaza al anterior. La aplicación no usa tu ubicación en segundo plano.</li>
<li><strong>Las denuncias que presentas:</strong> los datos de la persona buscada (nombre, número de carnet en hash, descripción física, vestimenta y una foto si es mayor de edad) y la zona aproximada, de alrededor de 1 km, donde se la vio por última vez. Nunca el punto exacto.</li>
<li><strong>Tus declaraciones juradas:</strong> el texto que aceptaste, la frase que escribiste para firmar y la firma de tu teléfono con su clave pública. La clave privada no sale de tu teléfono.</li>
<li><strong>Tus teléfonos:</strong> el identificador para enviarte notificaciones y si es Android o iPhone.</li>
<li><strong>Los reportes de contenido</strong> que hagas sobre una alerta.</li>
</ul>
<p>Lo que escribes al reportar un avistamiento <strong>no pasa por nuestro servidor</strong>: lo envías tú, desde tu teléfono, por llamada o mensaje. Solo registramos, sin saber quién, que se usó un canal para una alerta.</p>

<h2>Para qué los usamos</h2>
<ul>
<li>Para avisarte de las alertas cercanas y mostrarte el mapa.</li>
<li>Para que cada denuncia quede atribuida a una identidad: es lo que desalienta las denuncias falsas.</li>
<li>Para aplicar las sanciones automáticas cuando la persona afectada declara falsa una denuncia.</li>
<li>Para medir si las alertas llegan, sin usar el contenido de tus mensajes.</li>
</ul>
<p>No hay publicidad, no vendemos datos y no los usamos para nada más.</p>

<h2>Quién más los ve</h2>
<ul>
<li><strong>Las personas cercanas</strong> ven la alerta: los datos de la persona buscada. Nunca ven quién la denunció.</li>
<li><strong>Cualquiera con el enlace de una alerta</strong> ve su ficha pública, que tampoco incluye a quien la denunció y deja de mostrarse si la alerta se retira.</li>
<li><strong>La persona reportada</strong> en una denuncia puede pedir, después de retirarla, una constancia con el nombre de quien firmó la declaración jurada. Cada entrega queda registrada.</li>
<li><strong>Proveedores que hacen funcionar el servicio:</strong> Expo, Google y Apple reciben el identificador de tu teléfono y el texto de cada notificación (por ejemplo, el nombre de la persona buscada) para entregarla; Google Maps dibuja el mapa de la aplicación; Oracle Cloud aloja el servidor.</li>
<li><strong>Las autoridades</strong>, solo si una orden legal lo exige.</li>
</ul>

<h2>Cuánto tiempo y cómo eliminar tu cuenta</h2>
<p>Guardamos tus datos mientras tengas la cuenta. Puedes eliminarla cuando quieras desde la aplicación (Perfil → Eliminar mi cuenta) o, sin la aplicación, como se explica en <a href="/eliminar-cuenta">esta página</a>.</p>
${queSeBorraYQueQueda()}

<h2>Seguridad</h2>
<p>Toda la comunicación con el servidor va cifrada (HTTPS). Las contraseñas y los números de carnet se guardan como hash, y las declaraciones juradas forman una cadena que permite detectar si alguien alteró una.</p>

<h2>Menores de edad</h2>
<p>La aplicación es para mayores de 18 años. Si la persona buscada es menor de edad, su fotografía no se guarda.</p>

<h2>Cambios</h2>
<p>Si esta política cambia, la nueva versión se publica en esta misma dirección con su fecha.</p>
</article>
<footer>Alerta Temprana · ${enlaceDeCorreo(correo)}</footer>`
  );

export const htmlEliminarCuenta = (correo: string): string =>
  pagina(
    'Eliminar tu cuenta · Alerta Temprana',
    `<article class="hoja">
<p class="rotulo">Alerta Temprana</p>
<h1>Eliminar tu cuenta</h1>
<p class="fecha">Vigente desde el ${VIGENTE_DESDE}</p>

<div class="paso">
<h2>Desde la aplicación</h2>
<p>Abre <strong>Perfil</strong>, toca <strong>Eliminar mi cuenta</strong> y confírmalo con tu contraseña. Se elimina en el momento.</p>
</div>

<div class="paso">
<h2>Sin la aplicación</h2>
<p>Escribe a ${enlaceDeCorreo(correo, 'Eliminar mi cuenta')} <strong>desde el correo de tu cuenta</strong>, con el asunto «Eliminar mi cuenta». Así sabemos que el pedido es tuyo. La eliminamos en un plazo máximo de 30 días y te lo confirmamos por el mismo medio.</p>
</div>

<h2>Qué se borra y qué se conserva</h2>
${queSeBorraYQueQueda()}
<p>Más detalle en la <a href="/privacidad">política de privacidad</a>.</p>
</article>
<footer>Alerta Temprana · ${enlaceDeCorreo(correo)}</footer>`
  );
