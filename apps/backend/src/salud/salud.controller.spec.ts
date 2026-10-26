import { ServiceUnavailableException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { DataSource } from 'typeorm';
import { SaludController } from './salud.controller';

const conBase = (query: () => Promise<unknown>) =>
  new SaludController({ query } as unknown as DataSource);

describe('SaludController', () => {
  it('responde sano solo después de consultar la base', async () => {
    const query = jest.fn(async () => [{ '?column?': 1 }]);

    await expect(conBase(query).salud()).resolves.toEqual({ ok: true });
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('con la base caída responde 503, no «sano»', async () => {
    const caida = conBase(async () => {
      throw new Error('connect ECONNREFUSED');
    });

    await expect(caida.salud()).rejects.toThrow(ServiceUnavailableException);
  });

  it('se consulta sin sesión: la usa el healthcheck de Docker', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SaludController)).toBeUndefined();
  });
});
