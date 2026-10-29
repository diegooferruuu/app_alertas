import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { ReportesService, MENSAJE_REPORTE_RECIBIDO } from './reportes.service';
import { ReporteContenido } from './entities/reporte-contenido.entity';
import { CorreoService } from './correo.service';
import { DenunciasService } from '../denuncias/denuncias.service';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { FotografiaDenuncia } from '../denuncias/entities/fotografia-denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { conOcultamiento, vistaPublica } from '../denuncias/vista-publica';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { AlertasService } from '../alertas/alertas.service';
import { SancionesService } from '../sanciones/sanciones.service';

const hashDe = (ci: string) => createHash('sha256').update(ci).digest('hex');

describe('Reporte de contenido de una alerta (integración)', () => {
  let ctx: ContextoDePruebas;
  let reportesService: ReportesService;
  let denunciasService: DenunciasService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let reportes: Repository<ReporteContenido>;
  const avisar = jest.fn<Promise<void>, [string, string]>(async () => undefined);

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [TypeOrmModule.forFeature([ReporteContenido, Denuncia, FotografiaDenuncia, User])],
      providers: [
        ReportesService,
        DenunciasService,
        UsersService,
        { provide: CorreoService, useValue: { avisar } },
        // Reportar solo lee la denuncia: ni difunde ni sanciona.
        { provide: AlertasService, useValue: {} },
        { provide: SancionesService, useValue: {} },
      ],
    });
    reportesService = ctx.module.get(ReportesService);
    denunciasService = ctx.module.get(DenunciasService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    reportes = ctx.module.get(getRepositoryToken(ReporteContenido));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => {
    await ctx.limpiar();
    avisar.mockClear();
  });

  const crearUsuario = (email: string) =>
    usuarios.save(usuarios.create({ full_name: `Persona ${email}`, email, password_hash: 'x' }));

  const crearDenuncia = (autorId: string, nivel = NivelConfianza.PROVISIONAL) =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: hashDe('9999'),
        description: 'Relato de una denuncia anterior al formulario actual',
        latitude: -16.5,
        longitude: -68.15,
        nivel_confianza: nivel,
        estado: EstadoDenuncia.ACTIVA,
        // Sin firmar no tiene radio ni plazo: la base exige que vayan juntos.
        radio_actual_m: nivel === NivelConfianza.REGISTRADA ? null : 2000,
        expira_en:
          nivel === NivelConfianza.REGISTRADA ? null : new Date(Date.now() + 24 * 3600 * 1000),
      })
    );

  /** Espera a que salga el aviso, que el servicio dispara sin esperar. */
  const avisoEnviado = async () => {
    for (let i = 0; i < 50 && avisar.mock.calls.length === 0; i++) {
      await new Promise((r) => setTimeout(r, 10));
    }
  };

  it('guarda el reporte y avisa una vez, sin el nombre de la persona buscada', async () => {
    const autor = await crearUsuario('autor@test.bo');
    const vecino = await crearUsuario('vecino@test.bo');
    const denuncia = await crearDenuncia(autor.id);

    const respuesta = await reportesService.reportar(vecino.id, denuncia.id, {
      motivo: 'imagen_inapropiada',
      detalle: 'La foto no es de una persona',
    });
    await avisoEnviado();

    expect(respuesta.mensaje).toBe(MENSAJE_REPORTE_RECIBIDO);
    expect(await reportes.countBy({ denuncia_id: denuncia.id })).toBe(1);
    expect(avisar).toHaveBeenCalledTimes(1);
    const [asunto, texto] = avisar.mock.calls[0];
    expect(asunto).toBe('Reporte de contenido: Imagen inapropiada');
    expect(texto).toContain(denuncia.id);
    expect(texto).toContain('ocultar-contenido.sh');
    expect(texto).toContain(`borrar-imagen.sh ${denuncia.id}`);
    expect(texto).not.toContain('Luis Mamani');
  });

  it('reportar dos veces la misma alerta no suma ni vuelve a avisar, y responde igual', async () => {
    const autor = await crearUsuario('autor@test.bo');
    const vecino = await crearUsuario('vecino@test.bo');
    const denuncia = await crearDenuncia(autor.id);

    await reportesService.reportar(vecino.id, denuncia.id, { motivo: 'otro' });
    await avisoEnviado();
    const segunda = await reportesService.reportar(vecino.id, denuncia.id, {
      motivo: 'contenido_ofensivo',
    });

    expect(segunda.mensaje).toBe(MENSAJE_REPORTE_RECIBIDO);
    expect(await reportes.countBy({ denuncia_id: denuncia.id })).toBe(1);
    expect(avisar).toHaveBeenCalledTimes(1);
    // Borrar es solo para una imagen: con otro motivo no se ofrece.
    expect(avisar.mock.calls[0][1]).not.toContain('borrar-imagen.sh');
  });

  it('no se reporta la propia denuncia', async () => {
    const autor = await crearUsuario('autor@test.bo');
    const denuncia = await crearDenuncia(autor.id);

    await expect(
      reportesService.reportar(autor.id, denuncia.id, { motivo: 'otro' })
    ).rejects.toThrow(BadRequestException);
  });

  it('una denuncia que no se difundió responde como si no existiera', async () => {
    const autor = await crearUsuario('autor@test.bo');
    const vecino = await crearUsuario('vecino@test.bo');
    const sinFirmar = await crearDenuncia(autor.id, NivelConfianza.REGISTRADA);

    await expect(
      reportesService.reportar(vecino.id, sinFirmar.id, { motivo: 'otro' })
    ).rejects.toThrow(NotFoundException);
    expect(await reportes.count()).toBe(0);
  });

  it('los reportes no se pueden reescribir ni borrar', async () => {
    const autor = await crearUsuario('autor@test.bo');
    const vecino = await crearUsuario('vecino@test.bo');
    const denuncia = await crearDenuncia(autor.id);
    await reportesService.reportar(vecino.id, denuncia.id, { motivo: 'otro' });

    await expect(reportes.query(`DELETE FROM reportes_contenido`)).rejects.toThrow(
      /solo inserción/
    );
    await expect(reportes.query(`UPDATE reportes_contenido SET motivo = 'otro'`)).rejects.toThrow(
      /solo inserción/
    );
  });

  describe('ocultar el contenido', () => {
    const ocultar = (denunciaId: string) =>
      usuarios.query(
        `INSERT INTO ocultamientos_contenido (denuncia_id, motivo) VALUES ($1, 'foto obscena')`,
        [denunciaId]
      );

    it('quien no la presentó deja de ver la foto y el relato; el nombre sigue', async () => {
      const autor = await crearUsuario('autor@test.bo');
      const vecino = await crearUsuario('vecino@test.bo');
      const denuncia = await crearDenuncia(autor.id);
      await ocultar(denuncia.id);

      const oculta = await denunciasService.estaOculta(denuncia.id);
      const paraVecino = conOcultamiento(
        { ...vistaPublica(denuncia, vecino.id), fotografias: [{ contenido: 'x' }] },
        oculta
      );
      const paraAutor = conOcultamiento(
        { ...vistaPublica(denuncia, autor.id), fotografias: [{ contenido: 'x' }] },
        oculta
      );

      expect(paraVecino).toMatchObject({
        contenido_oculto: true,
        fotografias: [],
        description: null,
        nombre_persona_buscada: 'Luis Mamani',
      });
      // Quien la presentó lo sigue viendo todo, y sabe que se ocultó.
      expect(paraAutor.fotografias).toHaveLength(1);
      expect(paraAutor.contenido_oculto).toBe(true);
    });

    it('ocultar no cambia el estado de la alerta ni se puede deshacer en silencio', async () => {
      const autor = await crearUsuario('autor@test.bo');
      const denuncia = await crearDenuncia(autor.id);
      await ocultar(denuncia.id);

      expect((await denuncias.findOneByOrFail({ id: denuncia.id })).estado).toBe(
        EstadoDenuncia.ACTIVA
      );
      expect(await denunciasService.ocultasEntre([denuncia.id])).toEqual(new Set([denuncia.id]));
      await expect(usuarios.query(`DELETE FROM ocultamientos_contenido`)).rejects.toThrow(
        /solo inserción/
      );
    });

    it('una lista sin ocultas no cuesta nada y no inventa ninguna', async () => {
      const autor = await crearUsuario('autor@test.bo');
      const denuncia = await crearDenuncia(autor.id);

      expect(await denunciasService.ocultasEntre([])).toEqual(new Set());
      expect(await denunciasService.ocultasEntre([denuncia.id])).toEqual(new Set());
    });
  });
});
