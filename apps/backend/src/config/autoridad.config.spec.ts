import { paraWhatsApp } from './autoridad.config';

describe('paraWhatsApp', () => {
  it('agrega el código de Bolivia a un celular escrito sin él', () => {
    // `wa.me` necesita el número internacional: sin el 591, el enlace abre
    // un chat con otro país o con nadie.
    expect(paraWhatsApp('70000000')).toBe('59170000000');
    expect(paraWhatsApp('60000000')).toBe('59160000000');
  });

  it('quita espacios, guiones y el «+»', () => {
    expect(paraWhatsApp('+591 7000-0000')).toBe('59170000000');
  });

  it('deja como está un número que ya trae su código de país', () => {
    expect(paraWhatsApp('59170000000')).toBe('59170000000');
    expect(paraWhatsApp('5491100000000')).toBe('5491100000000');
  });

  it('sin valor no hay canal de mensajería', () => {
    expect(paraWhatsApp(undefined)).toBeNull();
    expect(paraWhatsApp('')).toBeNull();
    expect(paraWhatsApp('   ')).toBeNull();
  });
});
