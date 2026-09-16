import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PasarelaPushExpo } from './pasarela-push-expo';
import { MensajePush } from './pasarela-push';

/**
 * La pasarela real, con la red sustituida.
 *
 * No se prueba contra Expo: haría falta credencial, saldría a internet y los
 * tokens tendrían que ser de teléfonos reales. Lo que sí hay que fijar es cómo
 * se traduce cada respuesta posible a lo que queda escrito en `entregas_alerta`,
 * porque esa columna es la auditoría de a quién se avisó y es lo que después se
 * usa para medir la tasa de entrega. Atribuir mal un resultado ahí no se nota
 * nunca y ensucia la medición entera.
 */
describe('PasarelaPushExpo', () => {
  const config = (valores: Record<string, string> = {}) =>
    ({ get: (clave: string) => valores[clave] }) as unknown as ConfigService;

  const mensaje = (token: string): MensajePush => ({
    push_token: token,
    titulo: 'Alerta',
    cuerpo: 'Se busca a alguien cerca de ti.',
    datos: { denuncia_id: 'abc', motivo: 'zona' },
  });

  /** Respuesta correcta de Expo: un ticket por mensaje, en el mismo orden. */
  const respondeCon = (tickets: unknown[]) =>
    jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: tickets }),
    });

  let pasarela: PasarelaPushExpo;

  beforeEach(() => {
    // En el prototipo y antes de construir: el aviso de «sin credencial» sale
    // desde el constructor, y espiar la instancia llegaría tarde.
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();

    pasarela = new PasarelaPushExpo(config());
  });

  afterEach(() => {
    jest.restoreAllMocks();
    delete (global as any).fetch;
  });

  it('no sale a la red si no hay nada que enviar', async () => {
    const fetch = respondeCon([]);
    (global as any).fetch = fetch;

    expect(await pasarela.enviar([])).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('guarda el identificador del ticket de un envío aceptado', async () => {
    // El id es lo único con lo que después se puede consultar el recibo y saber
    // si la notificación llegó de verdad. Perderlo deja la entrega sin rastro.
    (global as any).fetch = respondeCon([{ status: 'ok', id: 'XXX-YYY' }]);

    const [resultado] = await pasarela.enviar([mensaje('ExponentPushToken[a]')]);

    expect(resultado).toEqual({
      push_token: 'ExponentPushToken[a]',
      aceptado: true,
      detalle: 'ticket XXX-YYY',
    });
  });

  it('manda canal y prioridad alta', async () => {
    // Sin `channelId`, Android 8+ recibe la notificación y no la muestra. El
    // nombre tiene que ser el mismo que crea la aplicación al registrarse.
    const fetch = respondeCon([{ status: 'ok', id: '1' }]);
    (global as any).fetch = fetch;

    await pasarela.enviar([mensaje('ExponentPushToken[a]')]);

    const enviado = JSON.parse(fetch.mock.calls[0][1].body);
    expect(enviado[0]).toMatchObject({
      to: 'ExponentPushToken[a]',
      channelId: 'alertas',
      priority: 'high',
      data: { denuncia_id: 'abc', motivo: 'zona' },
    });
  });

  it('da de baja el token que la pasarela reporta desinstalado', async () => {
    (global as any).fetch = respondeCon([
      {
        status: 'error',
        message: 'not a registered device',
        details: { error: 'DeviceNotRegistered' },
      },
    ]);

    const [resultado] = await pasarela.enviar([mensaje('ExponentPushToken[a]')]);

    expect(resultado.aceptado).toBe(false);
    expect(resultado.token_invalido).toBe(true);
  });

  it('otros errores de ticket no dan de baja el token', async () => {
    // `MessageTooBig` o `MessageRateExceeded` son problemas del mensaje o del
    // momento, no del aparato: borrarlo dejaría a esa persona sin alertas para
    // siempre por un fallo pasajero.
    (global as any).fetch = respondeCon([
      { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } },
    ]);

    const [resultado] = await pasarela.enviar([mensaje('ExponentPushToken[a]')]);

    expect(resultado.aceptado).toBe(false);
    expect(resultado.token_invalido).toBe(false);
    expect(resultado.detalle).toContain('MessageTooBig');
  });

  it('parte en lotes de 100', async () => {
    // Expo rechaza la petición entera por encima de 100. Una emisión de barrio
    // pasa de 100 destinatarios sin esfuerzo, así que sin esto no se enviaría
    // nada justo cuando más gente hay que alcanzar.
    const fetch = jest.fn().mockImplementation((_url, opciones) => {
      const cuerpo = JSON.parse(opciones.body);
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          data: cuerpo.map((_: unknown, i: number) => ({ status: 'ok', id: `t${i}` })),
        }),
      });
    });
    (global as any).fetch = fetch;

    const mensajes = Array.from({ length: 250 }, (_, i) =>
      mensaje(`ExponentPushToken[${i}]`),
    );
    const resultados = await pasarela.enviar(mensajes);

    expect(fetch).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toHaveLength(100);
    expect(JSON.parse(fetch.mock.calls[2][1].body)).toHaveLength(50);
    expect(resultados).toHaveLength(250);
    expect(resultados.every((r) => r.aceptado)).toBe(true);
    // Cada resultado conserva su token: quien consume casa por token, no por
    // posición, y un lote mal reensamblado escribiría la entrega de una persona
    // en la fila de otra.
    expect(resultados[149].push_token).toBe('ExponentPushToken[149]');
  });

  it('un corte de red falla el lote sin dar de baja a nadie', async () => {
    // El token puede estar perfectamente bien; quien falló fue la red.
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));

    const resultados = await pasarela.enviar([
      mensaje('ExponentPushToken[a]'),
      mensaje('ExponentPushToken[b]'),
    ]);

    expect(resultados).toHaveLength(2);
    expect(resultados.every((r) => !r.aceptado)).toBe(true);
    expect(resultados.some((r) => r.token_invalido)).toBe(false);
    expect(resultados[0].detalle).toContain('ETIMEDOUT');
  });

  it('una respuesta de error de la pasarela falla el lote', async () => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'service unavailable',
    });

    const [resultado] = await pasarela.enviar([mensaje('ExponentPushToken[a]')]);

    expect(resultado.aceptado).toBe(false);
    expect(resultado.detalle).toContain('503');
  });

  it('un rechazo de la petición completa falla el lote', async () => {
    // Credencial inválida o cuerpo mal formado: Expo devuelve `errors` y no
    // manda `data`. Sin este caso se leería `data` como vacío y los mensajes se
    // quedarían sin resultado, es decir, «encolada» para siempre.
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ errors: [{ message: 'Invalid credentials' }] }),
    });

    const [resultado] = await pasarela.enviar([mensaje('ExponentPushToken[a]')]);

    expect(resultado.aceptado).toBe(false);
    expect(resultado.detalle).toContain('Invalid credentials');
  });

  it('si no viene un ticket por mensaje, no se atribuye ninguno', async () => {
    // Antes que escribir en la auditoría el resultado de una persona en la fila
    // de otra, se da el lote por fallido: un fallo se reintenta, un dato de
    // auditoría equivocado no se detecta nunca.
    (global as any).fetch = respondeCon([{ status: 'ok', id: '1' }]);

    const resultados = await pasarela.enviar([
      mensaje('ExponentPushToken[a]'),
      mensaje('ExponentPushToken[b]'),
    ]);

    expect(resultados).toHaveLength(2);
    expect(resultados.every((r) => !r.aceptado)).toBe(true);
    expect(resultados[0].detalle).toContain('1 resultados para 2 mensajes');
  });

  it('manda la credencial cuando está configurada', async () => {
    const fetch = respondeCon([{ status: 'ok', id: '1' }]);
    (global as any).fetch = fetch;

    const conToken = new PasarelaPushExpo(config({ EXPO_ACCESS_TOKEN: 'secreto' }));
    await conToken.enviar([mensaje('ExponentPushToken[a]')]);

    expect(fetch.mock.calls[0][1].headers.authorization).toBe('Bearer secreto');
  });

  it('sin credencial no manda cabecera de autorización', async () => {
    const fetch = respondeCon([{ status: 'ok', id: '1' }]);
    (global as any).fetch = fetch;

    await pasarela.enviar([mensaje('ExponentPushToken[a]')]);

    expect(fetch.mock.calls[0][1].headers.authorization).toBeUndefined();
  });
});
