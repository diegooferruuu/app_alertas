import { Logger } from '@nestjs/common';
import { CaducidadScheduler } from './caducidad.scheduler';
import { DenunciasService } from './denuncias.service';

/**
 * El planificador es la *segunda* garantía de la caducidad, no la primera: si
 * falla, el filtro por `expira_en` de cada consulta sigue impidiendo que una
 * alerta vencida se difunda. Estas pruebas comprueban que ese fallo se absorbe
 * en lugar de propagarse.
 */
describe('CaducidadScheduler', () => {
  let denunciasService: { caducarVencidas: jest.Mock };
  let scheduler: CaducidadScheduler;

  beforeEach(() => {
    denunciasService = { caducarVencidas: jest.fn() };
    scheduler = new CaducidadScheduler(
      denunciasService as unknown as DenunciasService,
      {} as never,
      {} as never,
    );
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('caduca las alertas vencidas al ejecutarse', async () => {
    denunciasService.caducarVencidas.mockResolvedValue(3);

    await scheduler.ejecutar();

    expect(denunciasService.caducarVencidas).toHaveBeenCalledTimes(1);
  });

  it('no registra nada cuando no hay ninguna vencida', async () => {
    denunciasService.caducarVencidas.mockResolvedValue(0);
    const log = jest.spyOn(Logger.prototype, 'log');

    await scheduler.ejecutar();

    expect(log).not.toHaveBeenCalled();
  });

  it('absorbe un fallo de la base sin propagarlo', async () => {
    denunciasService.caducarVencidas.mockRejectedValue(
      new Error('conexión perdida'),
    );

    // Si esto lanzara, tumbaría el proceso: nadie espera esta tarea y no hay
    // quien capture el error más arriba.
    await expect(scheduler.ejecutar()).resolves.toBeUndefined();
  });

  it('deja registro del fallo para poder diagnosticarlo', async () => {
    denunciasService.caducarVencidas.mockRejectedValue(
      new Error('conexión perdida'),
    );
    const error = jest.spyOn(Logger.prototype, 'error');

    await scheduler.ejecutar();

    expect(error).toHaveBeenCalledWith(
      expect.stringContaining('conexión perdida'),
    );
  });
});
