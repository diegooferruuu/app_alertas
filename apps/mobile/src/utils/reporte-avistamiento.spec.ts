import { describe, expect, it } from '@jest/globals';
import {
  FRANJAS,
  armarReporte,
  enlaceDeLlamada,
  enlaceDeMapa,
  enlaceDeWhatsApp,
  momentoDe,
} from './reporte-avistamiento';

/**
 * Las horas se construyen y se leen en hora local, igual que en el teléfono:
 * así las pruebas no dependen de la zona horaria de la máquina que las corre.
 */
const a = (dia: number, h: number, m: number) => new Date(2026, 9, dia, h, m, 37);

describe('momentoDe', () => {
  it('convierte cada franja en horas del reloj', () => {
    const ahora = a(1, 14, 40);

    expect(momentoDe('MENOS_DE_30_MIN', ahora)).toBe('entre las 14:10 y las 14:40 del 01/10/2026');
    expect(momentoDe('DE_30_MIN_A_1_H', ahora)).toBe('entre las 13:40 y las 14:10 del 01/10/2026');
    expect(momentoDe('DE_1_A_3_H', ahora)).toBe('entre las 11:40 y las 13:40 del 01/10/2026');
  });

  it('la última franja no tiene comienzo: puede ser ayer', () => {
    expect(momentoDe('MAS_DE_3_H', a(1, 14, 40))).toBe('antes de las 11:40 del 01/10/2026');
  });

  it('pone las dos fechas cuando el rango cruza la medianoche', () => {
    expect(momentoDe('MENOS_DE_30_MIN', a(1, 0, 10))).toBe(
      'entre las 23:40 del 30/09/2026 y las 00:10 del 01/10/2026',
    );
  });

  it('un rango entero de ayer lleva la fecha de ayer', () => {
    expect(momentoDe('DE_30_MIN_A_1_H', a(1, 0, 20))).toBe(
      'entre las 23:20 y las 23:50 del 30/09/2026',
    );
  });

  it('las franjas no dejan huecos ni se pisan', () => {
    for (let i = 1; i < FRANJAS.length; i++) {
      expect(FRANJAS[i].desdeMin).toBe(FRANJAS[i - 1].hastaMin);
    }
    expect(FRANJAS[0].desdeMin).toBe(0);
    expect(FRANJAS[FRANJAS.length - 1].hastaMin).toBeNull();
  });
});

describe('armarReporte', () => {
  const base = {
    nombre: 'Luis Mamani',
    punto: { lat: -17.381879, lng: -66.151987 },
    calle: 'Av. Heroínas',
    franja: 'MENOS_DE_30_MIN' as const,
    ahora: a(1, 14, 40),
  };

  it('arma el texto que se lee o se envía', () => {
    expect(armarReporte(base)).toBe(
      [
        'Reporte de avistamiento — persona reportada como desaparecida',
        'Nombre: Luis Mamani',
        'Zona: Av. Heroínas — https://maps.google.com/?q=-17.38188,-66.15199',
        'Momento: entre las 14:10 y las 14:40 del 01/10/2026',
      ].join('\n'),
    );
  });

  it('no lleva el CI: quien recibe la alerta no lo tiene', () => {
    expect(armarReporte(base)).not.toMatch(/\bCI\b|carnet/i);
  });

  it('no lleva el número de caso de la FELCC: no es público', () => {
    expect(armarReporte(base)).not.toMatch(/FELCC|n[uú]mero de caso/i);
  });

  it('sin calle, la zona es solo el enlace del mapa', () => {
    expect(armarReporte({ ...base, calle: null })).toContain(
      'Zona: https://maps.google.com/?q=-17.38188,-66.15199',
    );
  });
});

describe('enlaces', () => {
  it('el mapa lleva el punto con cinco decimales, un metro de precisión', () => {
    expect(enlaceDeMapa(-17.3818799, -66.15198734)).toBe(
      'https://maps.google.com/?q=-17.38188,-66.15199',
    );
  });

  it('la llamada va sin espacios ni guiones', () => {
    expect(enlaceDeLlamada('7000 0000')).toBe('tel:70000000');
    expect(enlaceDeLlamada('+591 7000-0000')).toBe('tel:+59170000000');
    expect(enlaceDeLlamada('110')).toBe('tel:110');
  });

  it('WhatsApp recibe el número en dígitos y el texto codificado', () => {
    const enlace = enlaceDeWhatsApp('+59170000000', 'Nombre: Luis\nZona: Av. Heroínas — x');

    expect(enlace.startsWith('https://wa.me/59170000000?text=')).toBe(true);
    expect(decodeURIComponent(enlace.split('text=')[1])).toBe('Nombre: Luis\nZona: Av. Heroínas — x');
  });
});
