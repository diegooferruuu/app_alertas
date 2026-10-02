import { firmaValida, mensajeAFirmar } from './firma-dispositivo';
import { telefonoDePrueba } from '../../../test/setup/telefono-de-prueba';

/**
 * El mismo vector está en `apps/mobile/src/utils/mensaje-de-firma.spec.ts`. Si
 * el teléfono y el servidor armaran el mensaje distinto, toda firma se
 * rechazaría: este par de pruebas es lo que lo impide.
 */
const DATOS = {
  denuncia_id: '3f2a7c1e-9b4d-4e8a-a1f0-5c6d7e8f9a0b',
  hash_contenido_denuncia: 'a'.repeat(64),
  hash_texto_legal: 'b'.repeat(64),
  vinculo_declarado: 'MADRE',
  texto_firmado: 'María Fernanda Villarroel Quispe',
};
const MENSAJE_ESPERADO = [
  'declaracion-jurada/v1',
  '3f2a7c1e-9b4d-4e8a-a1f0-5c6d7e8f9a0b',
  'a'.repeat(64),
  'b'.repeat(64),
  'MADRE',
  'María Fernanda Villarroel Quispe',
].join('\n');

describe('mensajeAFirmar', () => {
  it('arma el mensaje en el formato publicado, idéntico al del teléfono', () => {
    expect(mensajeAFirmar(DATOS)).toBe(MENSAJE_ESPERADO);
  });

  it('cualquier cambio en lo declarado cambia el mensaje', () => {
    for (const campo of Object.keys(DATOS) as Array<keyof typeof DATOS>) {
      expect(mensajeAFirmar({ ...DATOS, [campo]: `${DATOS[campo]}x` })).not.toBe(MENSAJE_ESPERADO);
    }
  });
});

describe('firmaValida', () => {
  it('acepta la firma de la clave sobre ese mensaje', () => {
    const telefono = telefonoDePrueba();

    expect(firmaValida(telefono.clavePublica, MENSAJE_ESPERADO, telefono.firmar(MENSAJE_ESPERADO))).toBe(
      true,
    );
  });

  it('rechaza la firma de otro mensaje y la de otra clave', () => {
    const telefono = telefonoDePrueba();
    const otro = telefonoDePrueba();
    const firma = telefono.firmar(MENSAJE_ESPERADO);

    expect(firmaValida(telefono.clavePublica, `${MENSAJE_ESPERADO} `, firma)).toBe(false);
    expect(firmaValida(otro.clavePublica, MENSAJE_ESPERADO, firma)).toBe(false);
  });

  it('lo malformado cuenta como firma inválida, no como error', () => {
    const telefono = telefonoDePrueba();
    const firma = telefono.firmar(MENSAJE_ESPERADO);

    expect(firmaValida('zz', MENSAJE_ESPERADO, firma)).toBe(false);
    expect(firmaValida(telefono.clavePublica, MENSAJE_ESPERADO, firma.slice(2))).toBe(false);
    expect(firmaValida(telefono.clavePublica.toUpperCase(), MENSAJE_ESPERADO, firma)).toBe(false);
  });

  it('cumple el vector 1 de la RFC 8032, el mismo que usa la prueba del teléfono', () => {
    // Dos implementaciones distintas —Node aquí, @noble/curves en el teléfono—
    // de acuerdo sobre el estándar.
    expect(
      firmaValida(
        'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
        '',
        'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
      ),
    ).toBe(true);
  });
});
