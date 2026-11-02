import { describe, expect, it } from '@jest/globals';
import {
  FRANJAS,
  armarReporte,
  codigoDeCaso,
  enlaceDeFicha,
  enlaceDeLlamada,
  enlaceDeMapa,
  momentoDe,
  quienReporta,
  textoDeAcompanamiento,
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
  const ID = '5c3f0d7e-1111-4a2b-9c3d-123456789abc';
  const FICHA = `http://172.20.10.10:3000/api/fichas/${ID}`;
  const base = {
    denunciaId: ID,
    nombre: 'Luis Mamani',
    descripcion: 'Masculino · Entre 1,70 y 1,80 m · Chompa azul y pantalón jean negro',
    punto: { lat: -17.381879, lng: -66.151987 },
    calle: 'Av. Heroínas',
    franja: 'MENOS_DE_30_MIN' as const,
    ahora: a(1, 14, 40),
    reporta: { nombre: 'Caro Vaca Ortiz', conDocumento: true },
    ficha: FICHA,
  };
  const valor = (reporte: ReturnType<typeof armarReporte>, etiqueta: string) =>
    reporte.filas.find((f) => f.etiqueta === etiqueta)?.valor;

  it('lleva los campos que pidió el tribunal, en orden de lectura', () => {
    const reporte = armarReporte(base);

    expect(reporte.titulo).toBe('Reporte de avistamiento');
    expect(reporte.filas).toEqual([
      { etiqueta: 'Caso', valor: '5C3F0D7E' },
      { etiqueta: 'Persona buscada', valor: 'Luis Mamani' },
      {
        etiqueta: 'Descripción',
        valor: 'Masculino · Entre 1,70 y 1,80 m · Chompa azul y pantalón jean negro',
      },
      { etiqueta: 'Zona aproximada', valor: 'Av. Heroínas (-17.38188, -66.15199)' },
      { etiqueta: 'Franja horaria', valor: 'entre las 14:10 y las 14:40 del 01/10/2026' },
      { etiqueta: 'Reporta', valor: 'Caro Vaca Ortiz (con documento registrado)' },
    ]);
    expect(reporte.generado).toBe(
      'Generado el 01/10/2026 a las 14:40 en el teléfono de quien reporta',
    );
  });

  it('el caso es el mismo código que muestra la ficha pública', () => {
    expect(codigoDeCaso(ID)).toBe('5C3F0D7E');
  });

  it('dice si el nombre de quien reporta viene de una cuenta sin documento registrado', () => {
    expect(
      valor(armarReporte({ ...base, reporta: { nombre: 'Caro', conDocumento: false } }), 'Reporta'),
    ).toBe('Caro (sin documento registrado)');
  });

  it('sin la cuenta cargada sale igual, sin esa fila', () => {
    const reporte = armarReporte({ ...base, reporta: null });

    expect(valor(reporte, 'Reporta')).toBeUndefined();
    expect(valor(reporte, 'Franja horaria')).toBeDefined();
  });

  it('sin descripción ni calle, no inventa: omite la fila y deja las coordenadas', () => {
    const reporte = armarReporte({ ...base, descripcion: null, calle: null });

    expect(valor(reporte, 'Descripción')).toBeUndefined();
    expect(valor(reporte, 'Zona aproximada')).toBe('-17.38188, -66.15199');
  });

  it('no lleva el CI: quien recibe la alerta no lo tiene', () => {
    expect(JSON.stringify(armarReporte(base))).not.toMatch(/\bCI\b|carnet/i);
  });

  it('no lleva el número de caso de la FELCC: no es público', () => {
    expect(JSON.stringify(armarReporte(base))).not.toMatch(/FELCC|n[uú]mero de caso/i);
  });
});

describe('textoDeAcompanamiento', () => {
  const ID = '5c3f0d7e-1111-4a2b-9c3d-123456789abc';
  const base = {
    denunciaId: ID,
    nombre: 'Luis Mamani',
    descripcion: null,
    punto: { lat: -17.381879, lng: -66.151987 },
    calle: 'Av. Heroínas',
    franja: 'MENOS_DE_30_MIN' as const,
    ahora: a(1, 14, 40),
    reporta: { nombre: 'Caro Vaca Ortiz', conDocumento: true },
    ficha: `http://172.20.10.10:3000/api/fichas/${ID}`,
  };

  it('lleva el código de caso y los enlaces, que en la imagen no se pueden tocar', () => {
    expect(textoDeAcompanamiento(base)).toBe(
      [
        'Reporte de avistamiento del caso 5C3F0D7E, enviado desde Alerta Temprana. Los datos van en la imagen.',
        'Mapa del lugar: https://maps.google.com/?q=-17.38188,-66.15199',
        `Ficha de la persona: http://172.20.10.10:3000/api/fichas/${ID}`,
      ].join('\n'),
    );
  });

  it('no repite los datos de la imagen: lo editable no puede contradecirla', () => {
    const texto = textoDeAcompanamiento(base);

    expect(texto).not.toContain('Luis Mamani');
    expect(texto).not.toContain('Caro Vaca Ortiz');
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

  it('la ficha cuelga de la dirección de la API, con o sin barra final', () => {
    const id = '5c3f0d7e-1111-4a2b-9c3d-123456789abc';

    expect(enlaceDeFicha('http://172.20.10.10:3000/api', id)).toBe(
      `http://172.20.10.10:3000/api/fichas/${id}`,
    );
    expect(enlaceDeFicha('http://172.20.10.10:3000/api/', id)).toBe(
      `http://172.20.10.10:3000/api/fichas/${id}`,
    );
  });
});

describe('quienReporta', () => {
  it('usa el nombre de la cuenta y dice si tiene documento registrado', () => {
    expect(quienReporta({ full_name: 'Caro Vaca Ortiz', documento_registrado: true })).toEqual({
      nombre: 'Caro Vaca Ortiz',
      conDocumento: true,
    });
    expect(quienReporta({ full_name: ' Caro Vaca ', documento_registrado: false })).toEqual({
      nombre: 'Caro Vaca',
      conDocumento: false,
    });
  });
});
