import { describe, expect, it } from '@jest/globals';
import { conMayuscula, partesDelTexto, textoConVinculo } from './texto-legal';

const PLANTILLA =
  'Declaro bajo juramento ser {{VINCULO}} de la persona que reporto como desaparecida.';

describe('texto legal con el vínculo', () => {
  it('escribe el vínculo elegido en lugar del marcador', () => {
    expect(textoConVinculo(PLANTILLA, 'madre')).toBe(
      'Declaro bajo juramento ser madre de la persona que reporto como desaparecida.',
    );
  });

  it('lo reemplaza todas las veces que aparezca', () => {
    expect(textoConVinculo('{{VINCULO}} y {{VINCULO}}', 'tutor legal')).toBe(
      'tutor legal y tutor legal',
    );
  });

  it('un texto sin marcador queda igual', () => {
    expect(textoConVinculo('Sin marcador.', 'padre')).toBe('Sin marcador.');
  });

  it('parte el texto donde va el vínculo, para poder resaltarlo', () => {
    expect(partesDelTexto(PLANTILLA)).toEqual([
      'Declaro bajo juramento ser ',
      ' de la persona que reporto como desaparecida.',
    ]);
  });

  it('pone la primera letra en mayúscula para mostrar la etiqueta sola', () => {
    expect(conMayuscula('hijo o hija')).toBe('Hijo o hija');
    expect(conMayuscula('cónyuge')).toBe('Cónyuge');
  });
});
