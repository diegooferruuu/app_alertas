/**
 * Texto legal de la declaración jurada.
 *
 * ⚠️ BORRADOR PENDIENTE DE REVISIÓN LEGAL.
 *
 * Este texto es el núcleo jurídico del sistema: es lo que la persona acepta y
 * lo que después se le opone si la denuncia resulta falsa. Antes de operar con
 * usuarios reales debe revisarlo un abogado, en particular:
 *
 *  - La tipificación exacta de la denuncia falsa en la legislación boliviana y
 *    la pena que corresponde, para no afirmar consecuencias inexactas.
 *  - El tratamiento que la Ley 164 y su reglamentación dan a la firma
 *    electrónica frente a la firma digital, antes de atribuir a este mecanismo
 *    un valor probatorio determinado.
 *  - Si la advertencia sobre tratamiento de datos personales cumple lo exigido.
 *
 * Está redactado en primera persona a propósito: la persona escribirá su nombre
 * a mano justo después, y la frase que escribe debe cerrar sentido con lo que
 * acaba de leer.
 */

export const VERSION_INICIAL = 'v1';

export const TEXTO_LEGAL_V1 = `DECLARACIÓN JURADA DE DENUNCIA POR DESAPARICIÓN

Declaro bajo juramento ser {{VINCULO}} de la persona que reporto como desaparecida, y que los datos que he consignado en esta denuncia son verdaderos.

RESPONSABILIDAD PENAL

Conozco que presentar una denuncia falsa constituye un delito conforme a la legislación boliviana y acarrea responsabilidad penal. Entiendo que esta declaración puede ser presentada como prueba ante una autoridad competente.

REGISTRO PERMANENTE DE MI IDENTIDAD

Acepto que mi identidad, el documento con el que registré mi cuenta y el vínculo que acabo de declarar queden asociados de forma permanente e inalterable a esta denuncia.

Comprendo que la persona a la que reporto puede solicitar una constancia con estos datos, y que esa constancia le será entregada sin necesidad de que justifique su solicitud. Acepto esta atribución como condición para que la alerta se difunda.

CONSECUENCIAS DENTRO DEL SISTEMA

Entiendo que, si la persona reportada desactiva esta alerta:

1. La alerta dejará de difundirse de inmediato y los avistamientos asociados serán eliminados.
2. Mi puntaje de reputación será penalizado y mi cuenta quedará restringida por un plazo, durante el cual no podré crear nuevas denuncias.
3. Si esto ocurre por segunda vez, mi cuenta será suspendida y mi documento quedará bloqueado para volver a registrarse.
4. Si reporto dos veces a la misma persona y ambas veces desactiva la alerta, la suspensión será inmediata.

Comprendo que estas consecuencias son automáticas y que no existe una instancia administradora ante la cual apelar.

ALCANCE DE LA DIFUSIÓN

Entiendo que esta denuncia se difundirá mediante notificaciones a personas que se encuentren en la zona del último lugar conocido, que ese alcance es limitado y que la alerta caducará por sí sola si nadie corrobora el caso dentro del plazo establecido.

Declaro haber leído íntegramente este texto antes de aceptarlo.`;
