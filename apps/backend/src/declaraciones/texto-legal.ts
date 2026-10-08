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

/**
 * Segunda versión: el régimen de faltas.
 *
 * Reemplaza las consecuencias de la v1 —puntaje de reputación y restricción
 * temporal— por las del régimen vigente, y nombra el único respaldo que amplía
 * una alerta: el número de caso de la FELCC. Lo demás es idéntico a la v1.
 *
 * La v1 **no se toca nunca**: las declaraciones ya firmadas la referencian y su
 * hash está guardado. Cambiar el texto de una versión publicada haría que esas
 * constancias dejaran de verificar.
 */
export const VERSION_REGIMEN_FALTAS = 'v2';

export const TEXTO_LEGAL_V2 = `DECLARACIÓN JURADA DE DENUNCIA POR DESAPARICIÓN

Declaro bajo juramento ser {{VINCULO}} de la persona que reporto como desaparecida, y que los datos que he consignado en esta denuncia son verdaderos.

RESPONSABILIDAD PENAL

Conozco que presentar una denuncia falsa constituye un delito conforme a la legislación boliviana y acarrea responsabilidad penal. Entiendo que esta declaración puede ser presentada como prueba ante una autoridad competente.

REGISTRO PERMANENTE DE MI IDENTIDAD

Acepto que mi identidad, el documento con el que registré mi cuenta y el vínculo que acabo de declarar queden asociados de forma permanente e inalterable a esta denuncia.

Comprendo que la persona a la que reporto puede solicitar una constancia con estos datos, y que esa constancia le será entregada sin necesidad de que justifique su solicitud. Acepto esta atribución como condición para que la alerta se difunda.

CONSECUENCIAS DENTRO DEL SISTEMA

Entiendo que la persona reportada puede cerrar esta alerta en cualquier momento, declarando que está bien o que esta denuncia es falsa, y que en ambos casos la alerta dejará de difundirse de inmediato.

Si declara que está bien, no recibiré ninguna sanción. Podrá decidir, además, si puedo volver a denunciarla.

Si declara que esta denuncia es falsa:

1. Recibiré una falta, que quedará registrada de forma permanente.
2. No podré volver a denunciar a esa persona.
3. Mientras tenga una falta, las alertas que presente solo se difundirán si registro el número de caso de la FELCC.
4. Si dos personas distintas declaran falsas denuncias mías, mi cuenta será suspendida y mi documento quedará bloqueado para volver a registrarse.

Comprendo que estas consecuencias son automáticas y que no existe una instancia administradora ante la cual apelar.

ALCANCE DE LA DIFUSIÓN

Entiendo que esta denuncia se difundirá mediante notificaciones a personas que se encuentren en la zona del último lugar conocido, que ese alcance es limitado y que la alerta caducará por sí sola si el caso no se respalda con el número de caso de la FELCC dentro del plazo establecido.

Declaro haber leído íntegramente este texto antes de aceptarlo.`;

/**
 * Tercera versión: sin la FELCC (2026-10-04).
 *
 * Quita el número de caso de la FELCC, que el sistema no podía comprobar —no es
 * público—, y describe lo que lo reemplaza: la suspensión de siete días que deja
 * cada falta, y la prolongación de la alerta sin volver a notificar, firmada
 * bajo este mismo juramento. Agrega que la alerta no reemplaza la denuncia ante
 * la Policía. Lo demás es idéntico a la v2.
 *
 * Los siete días y las tres prolongaciones van escritos a propósito: es lo que
 * la persona acepta. Si cambian `DIAS_SUSPENSION_TEMPORAL` o
 * `MAX_PROLONGACIONES`, corresponde publicar otra versión.
 *
 * La v1 y la v2 **no se tocan nunca**, por la misma razón de siempre: hay
 * declaraciones firmadas que las referencian.
 */
export const VERSION_SIN_FELCC = 'v3';

export const TEXTO_LEGAL_V3 = `DECLARACIÓN JURADA DE DENUNCIA POR DESAPARICIÓN

Declaro bajo juramento ser {{VINCULO}} de la persona que reporto como desaparecida, y que los datos que he consignado en esta denuncia son verdaderos.

RESPONSABILIDAD PENAL

Conozco que presentar una denuncia falsa constituye un delito conforme a la legislación boliviana y acarrea responsabilidad penal. Entiendo que esta declaración puede ser presentada como prueba ante una autoridad competente.

REGISTRO PERMANENTE DE MI IDENTIDAD

Acepto que mi identidad, el documento con el que registré mi cuenta y el vínculo que acabo de declarar queden asociados de forma permanente e inalterable a esta denuncia.

Comprendo que la persona a la que reporto puede solicitar una constancia con estos datos, y que esa constancia le será entregada sin necesidad de que justifique su solicitud. Acepto esta atribución como condición para que la alerta se difunda.

CONSECUENCIAS DENTRO DEL SISTEMA

Entiendo que la persona reportada puede cerrar esta alerta en cualquier momento, declarando que está bien o que esta denuncia es falsa, y que en ambos casos la alerta dejará de difundirse de inmediato.

Si declara que está bien, no recibiré ninguna sanción. Podrá decidir, además, si puedo volver a denunciarla.

Si declara que esta denuncia es falsa:

1. Recibiré una falta, que quedará registrada de forma permanente.
2. No podré volver a denunciar a esa persona.
3. Durante siete días no podré registrar, firmar ni prolongar denuncias, y las demás alertas que tenga en difusión dejarán de difundirse.
4. Si dos personas distintas declaran falsas denuncias mías, mi cuenta será suspendida y mi documento quedará bloqueado para volver a registrarse.

Comprendo que estas consecuencias son automáticas y que no existe una instancia administradora ante la cual apelar.

ALCANCE DE LA DIFUSIÓN

Entiendo que esta denuncia se difundirá mediante una notificación a las personas que se encuentren en la zona del último lugar conocido, que ese alcance es limitado y que la alerta caducará por sí sola al cumplirse el plazo establecido.

Podré prolongar la alerta hasta tres veces, sin que se vuelva a notificar a nadie. Cada vez que la prolongue declararé, bajo este mismo juramento, que la persona sigue sin aparecer.

Entiendo que esta alerta no reemplaza la denuncia ante la Policía, que corresponde presentar en la FELCC.

Declaro haber leído íntegramente este texto antes de aceptarlo.`;
