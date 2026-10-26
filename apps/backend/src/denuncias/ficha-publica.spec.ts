import { EstadoDenuncia } from './domain/estados';
import { MOTIVO_SIN_FOTOGRAFIA } from './domain/minoria-edad';
import {
  DenunciaDeFicha,
  htmlDeFicha,
  htmlFichaNoDisponible,
  tipoDeImagen,
} from './ficha-publica';

const AHORA = new Date('2026-10-08T15:00:00.000Z');
const URL_FOTO = 'http://172.20.10.10:3000/api/fichas/5c3f0d7e-1111-4a2b-9c3d-123456789abc/foto';

const denuncia = (cambios: Partial<DenunciaDeFicha> = {}): DenunciaDeFicha => ({
  nombre_persona_buscada: 'Rosa Vargas',
  estado: EstadoDenuncia.ACTIVA,
  expira_en: new Date('2026-10-09T12:00:00.000Z'),
  fecha_nacimiento: '1962-05-14',
  sexo: 'FEMENINO',
  estatura_rango: 'DE_150_A_160',
  contextura: 'DELGADA',
  color_piel: 'TRIGUENA',
  color_cabello: 'CANOSO',
  color_ojos: 'CAFES_OSCUROS',
  senas_particulares: ['LENTES'],
  prenda_superior: 'CHOMPA',
  color_prenda_superior: 'AZUL',
  prenda_inferior: 'POLLERA',
  color_prenda_inferior: 'NEGRO',
  calzado: 'SANDALIAS',
  condicion_relevante: ['DIFICULTAD_DE_ORIENTACION'],
  circunstancia: 'EXTRAVIO_EN_VIA_PUBLICA',
  ultimo_avistamiento_en: new Date('2026-10-07T18:20:00.000Z'),
  latitude: -17.385,
  longitude: -66.155,
  ...cambios,
});

describe('Ficha pública de una alerta', () => {
  it('escapa el nombre: es el único texto libre y no puede inyectar marcado', () => {
    const html = htmlDeFicha(denuncia({ nombre_persona_buscada: '<script>alert(1)</script> & "x"' }), {
      urlFoto: null,
      ahora: AHORA,
    });

    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;x&quot;');
  });

  it('no escribe nada de quien presentó la denuncia, aunque la entidad lo traiga (I8)', () => {
    const conDenunciante = {
      ...denuncia(),
      denunciante_id: '9f0e1d2c-3b4a-4596-8877-665544332211',
      denunciante: { full_name: 'Ana Quispe Vargas', email: 'ana@demo.bo' },
    } as unknown as DenunciaDeFicha;

    const html = htmlDeFicha(conDenunciante, { urlFoto: null, ahora: AHORA });

    expect(html).not.toContain('9f0e1d2c');
    expect(html).not.toContain('Ana Quispe');
    expect(html).not.toContain('ana@demo.bo');
  });

  it('describe a la persona con las mismas etiquetas que la aplicación', () => {
    const html = htmlDeFicha(denuncia(), { urlFoto: null, ahora: AHORA });

    expect(html).toContain('<dd>64 años</dd>');
    expect(html).toContain('<dd>Femenino</dd>');
    expect(html).toContain('<dd>Entre 1,50 y 1,60 m</dd>');
    expect(html).toContain('<dd>Usa lentes</dd>');
    expect(html).toContain('<dd>Chompa azul y pollera negro</dd>');
    expect(html).toContain('<dd>Dificultad para orientarse</dd>');
    expect(html).toContain('<dd>Se extravió en la vía pública</dd>');
  });

  it('el último avistamiento va en la hora de Bolivia, no en la del servidor', () => {
    // 18:20 UTC son las 14:20 en La Paz.
    const html = htmlDeFicha(denuncia(), { urlFoto: null, ahora: AHORA });

    expect(html).toContain('<dd>7 de octubre de 2026, 14:20</dd>');
  });

  it('el mapa apunta a la zona reducida que guarda la base, no a un punto exacto', () => {
    const html = htmlDeFicha(denuncia(), { urlFoto: null, ahora: AHORA });

    expect(html).toContain('https://maps.google.com/?q=-17.38500,-66.15500');
    expect(html).toContain('aproximada, ~1 km');
  });

  it('con foto, la muestra y la anuncia para la vista previa del enlace', () => {
    const html = htmlDeFicha(denuncia(), { urlFoto: URL_FOTO, ahora: AHORA });

    expect(html).toContain(`<meta property="og:image" content="${URL_FOTO}">`);
    expect(html).toContain(`<img src="${URL_FOTO}"`);
    expect(html).toContain('<meta property="og:title" content="Se busca a Rosa Vargas">');
  });

  it('sin foto de un menor, explica por qué en vez de mostrar un hueco', () => {
    const html = htmlDeFicha(denuncia({ fecha_nacimiento: '2016-03-01' }), {
      urlFoto: null,
      ahora: AHORA,
    });

    expect(html).toContain(MOTIVO_SIN_FOTOGRAFIA);
    expect(html).not.toContain('og:image');
    expect(html).not.toContain('<img');
  });

  it('una vencida avisa que ya no se difunde, sin dar a entender que la persona apareció', () => {
    const marcada = htmlDeFicha(denuncia({ estado: EstadoDenuncia.CADUCADA }), {
      urlFoto: null,
      ahora: AHORA,
    });
    // Vencida por plazo aunque el planificador todavía no la haya marcado.
    const sinMarcar = htmlDeFicha(denuncia({ expira_en: new Date('2026-10-08T14:00:00.000Z') }), {
      urlFoto: null,
      ahora: AHORA,
    });

    for (const html of [marcada, sinMarcar]) {
      expect(html).toContain('La alerta ya no se difunde, pero nadie informó que la persona apareció.');
    }
    expect(htmlDeFicha(denuncia(), { urlFoto: null, ahora: AHORA })).toContain(
      'Alerta activa: se busca a esta persona.',
    );
  });

  it('pide no ser indexada por buscadores y no ejecuta nada', () => {
    for (const html of [
      htmlDeFicha(denuncia(), { urlFoto: URL_FOTO, ahora: AHORA }),
      htmlFichaNoDisponible(),
    ]) {
      expect(html).toContain('<meta name="robots" content="noindex, nofollow">');
      expect(html).not.toContain('<script');
    }
  });

  it('la ficha no disponible no dice nada de ninguna alerta', () => {
    const html = htmlFichaNoDisponible();

    expect(html).toContain('Esta ficha ya no se muestra');
    expect(html).not.toContain('og:');
    expect(html).not.toContain('<dl>');
  });
});

describe('tipoDeImagen', () => {
  it('reconoce JPEG, PNG y WebP por su firma', () => {
    expect(tipoDeImagen(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBe('image/jpeg');
    expect(
      tipoDeImagen(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])),
    ).toBe('image/png');
    expect(tipoDeImagen(Buffer.from('RIFF\x00\x00\x00\x00WEBPVP8 ', 'latin1'))).toBe('image/webp');
  });

  it('lo que no es una imagen cuenta como «sin foto», como el texto de los datos de demostración', () => {
    expect(tipoDeImagen(Buffer.from('foto-de-demostracion'))).toBeNull();
    expect(tipoDeImagen(Buffer.alloc(0))).toBeNull();
  });
});
