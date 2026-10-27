import { describe, expect, it } from '@jest/globals';
import { paginaPublica } from './sitio';

describe('paginaPublica', () => {
  it('quita el /api: las páginas legales viven en la raíz del sitio', () => {
    expect(paginaPublica('https://152-67-46-104.sslip.io/api', 'privacidad')).toBe(
      'https://152-67-46-104.sslip.io/privacidad',
    );
  });

  it('tolera la barra final y el puerto del backend local', () => {
    expect(paginaPublica('http://192.168.1.5:3000/api/', 'eliminar-cuenta')).toBe(
      'http://192.168.1.5:3000/eliminar-cuenta',
    );
  });
});
