import {
  aZonaDeAvistamiento,
  aCentroDeCelda,
  estaReducido,
  PASO_REJILLA,
} from './zona-avistamiento';

/**
 * El invariante: la ubicación exacta de un avistamiento no debe existir en la
 * base de datos. Estas pruebas fijan que la reducción realmente reduce, que es
 * estable, y que no se cuela un punto preciso por descuido.
 */
describe('Zona de avistamiento', () => {
  const laPaz = { latitude: -16.4957, longitude: -68.1335 };

  it('reduce un punto preciso a la celda que lo contiene', () => {
    const zona = aZonaDeAvistamiento(laPaz);

    expect(zona.latitude).not.toBe(laPaz.latitude);
    expect(zona.longitude).not.toBe(laPaz.longitude);
  });

  it('el punto guardado queda a menos de un kilómetro del real', () => {
    const zona = aZonaDeAvistamiento(laPaz);

    // Media celda en cada eje: 0,005 grados son unos 550 m de latitud.
    expect(Math.abs(zona.latitude - laPaz.latitude)).toBeLessThanOrEqual(
      PASO_REJILLA / 2,
    );
    expect(Math.abs(zona.longitude - laPaz.longitude)).toBeLessThanOrEqual(
      PASO_REJILLA / 2,
    );
  });

  it('dos puntos de la misma manzana caen en la misma zona', () => {
    // Es lo que hace que la reducción proteja: la dirección concreta deja de
    // ser distinguible dentro de la celda.
    const unaCasa = { latitude: -16.4957, longitude: -68.1335 };
    const laDeAlLado = { latitude: -16.4959, longitude: -68.1337 };

    expect(aZonaDeAvistamiento(unaCasa)).toEqual(
      aZonaDeAvistamiento(laDeAlLado),
    );
  });

  it('dos puntos lejanos siguen en zonas distintas', () => {
    const laPazZona = aZonaDeAvistamiento(laPaz);
    const elAlto = aZonaDeAvistamiento({ latitude: -16.5, longitude: -68.2 });

    expect(laPazZona).not.toEqual(elAlto);
  });

  it('es idempotente: reducir una zona ya reducida no la mueve', () => {
    // De esto depende el sellado. Si reducir dos veces diera valores distintos,
    // recalcular el hash de contenido de una denuncia ya firmada fallaría.
    const zona = aZonaDeAvistamiento(laPaz);

    expect(aZonaDeAvistamiento(zona)).toEqual(zona);
    expect(estaReducido(zona)).toBe(true);
  });

  it('el mismo punto siempre da el mismo resultado', () => {
    expect(aZonaDeAvistamiento(laPaz)).toEqual(aZonaDeAvistamiento({ ...laPaz }));
  });

  it('funciona en los cuatro cuadrantes del planeta', () => {
    // Bolivia está en latitud y longitud negativas, donde el redondeo hacia
    // abajo se comporta distinto que con números positivos.
    for (const punto of [
      { latitude: -16.4957, longitude: -68.1335 },
      { latitude: 16.4957, longitude: 68.1335 },
      { latitude: -16.4957, longitude: 68.1335 },
      { latitude: 16.4957, longitude: -68.1335 },
    ]) {
      const zona = aZonaDeAvistamiento(punto);
      expect(Math.abs(zona.latitude - punto.latitude)).toBeLessThanOrEqual(
        PASO_REJILLA / 2,
      );
      expect(estaReducido(zona)).toBe(true);
    }
  });

  it('no arrastra ruido decimal de coma flotante', () => {
    // Estos valores entran en el hash del contenido como texto: un decimal de
    // más produciría una cadena distinta para el mismo punto.
    const zona = aZonaDeAvistamiento(laPaz);

    expect(String(zona.latitude)).toMatch(/^-?\d+\.\d{1,7}$/);
    expect(String(zona.longitude)).toMatch(/^-?\d+\.\d{1,7}$/);
  });

  describe('aCentroDeCelda', () => {
    it('devuelve el centro y no la esquina de la celda', () => {
      // Con la esquina, el error sería de hasta una celda entera; con el
      // centro, de media.
      expect(aCentroDeCelda(-16.4957)).toBe(-16.495);
      expect(aCentroDeCelda(-16.4901)).toBe(-16.495);
    });
  });
});
