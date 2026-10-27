import { GUARDS_METADATA, HEADERS_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { LegalController } from './legal.controller';
import { htmlEliminarCuenta, htmlPoliticaDePrivacidad } from './paginas-legales';
import { CONTACTO_CONFIG } from '../config/contacto.config';

const CORREO = 'contacto@ejemplo.bo';

const controlador = () =>
  new LegalController({
    getOrThrow: (clave: string) => (clave === CONTACTO_CONFIG ? { correo: CORREO } : undefined),
  } as unknown as ConfigService);

/** Las listas de «Se borran» y «Se conserva», tal como salen en una página. */
const loQueSeBorraYQueda = (html: string) =>
  html.slice(html.indexOf('<p>Se borran:'), html.indexOf('recuperas esa cuenta'));

describe('Páginas legales', () => {
  it('se abren sin sesión: la de eliminación tiene que servir sin la app', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, LegalController)).toBeUndefined();
    for (const metodo of ['privacidad', 'eliminarCuenta'] as const) {
      expect(
        Reflect.getMetadata(GUARDS_METADATA, LegalController.prototype[metodo])
      ).toBeUndefined();
    }
  });

  it('no ejecutan nada ni cargan nada de fuera', () => {
    for (const metodo of ['privacidad', 'eliminarCuenta'] as const) {
      const cabeceras: Array<{ name: string; value: string }> = Reflect.getMetadata(
        HEADERS_METADATA,
        LegalController.prototype[metodo]
      );
      const csp = cabeceras.find((c) => c.name === 'Content-Security-Policy')?.value;
      expect(csp).toContain("default-src 'none'");
      expect(controlador()[metodo]()).not.toContain('<script');
    }
  });

  it('la de eliminación dice cómo pedirla sin la app, por el correo de contacto', () => {
    const html = controlador().eliminarCuenta();

    expect(html).toContain(`mailto:${CORREO}?subject=Eliminar%20mi%20cuenta`);
    expect(html).toContain('desde el correo de tu cuenta');
    expect(html).toContain('Alerta Temprana');
  });

  it('la política dice lo que el código hace con el carnet, la ubicación y el avistamiento', () => {
    const html = controlador().privacidad();

    expect(html).toContain('no guardamos las imágenes ni ninguna medida de tu rostro');
    expect(html).toContain('no usa tu ubicación en segundo plano');
    expect(html).toContain('<strong>no pasa por nuestro servidor</strong>');
    expect(html).toContain('href="/eliminar-cuenta"');
    expect(html).toContain(CORREO);
  });

  it('las dos páginas dicen lo mismo sobre qué se borra y qué se conserva', () => {
    const enLaPolitica = loQueSeBorraYQueda(htmlPoliticaDePrivacidad(CORREO));

    expect(enLaPolitica).toContain('el número de tu carnet, solo en forma de hash');
    expect(loQueSeBorraYQueda(htmlEliminarCuenta(CORREO))).toBe(enLaPolitica);
  });

  it('el correo se escapa: viene de la configuración, no del código', () => {
    expect(htmlPoliticaDePrivacidad('a"<b>@x.bo')).not.toContain('a"<b>');
  });
});
