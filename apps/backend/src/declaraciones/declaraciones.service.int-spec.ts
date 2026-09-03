import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { DeclaracionesService } from './declaraciones.service';
import { VersionTextoLegal } from './entities/version-texto-legal.entity';
import { TEXTO_LEGAL_V1, VERSION_INICIAL } from './texto-legal';

describe('Texto legal versionado (integración)', () => {
  let ctx: ContextoDePruebas;
  let service: DeclaracionesService;
  let versiones: Repository<VersionTextoLegal>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [TypeOrmModule.forFeature([VersionTextoLegal])],
      providers: [DeclaracionesService],
    });
    service = ctx.module.get(DeclaracionesService);
    versiones = ctx.module.get(getRepositoryToken(VersionTextoLegal));
  });

  afterAll(async () => {
    await ctx.cerrar();
  });

  /**
   * A diferencia de las demás pruebas, aquí no se vacía la tabla: la versión
   * inicial la siembra la migración porque el sistema no puede funcionar sin
   * ella. Borrarla probaría un estado que no debe existir.
   */
  beforeEach(async () => {
    await versiones.delete({ vigente: false });
  });

  it('la migración deja una versión vigente: sin ella no se puede firmar', async () => {
    const vigente = await service.textoLegalVigente();

    expect(vigente.version).toBe(VERSION_INICIAL);
    expect(vigente.texto).toBe(TEXTO_LEGAL_V1);
  });

  it('el hash corresponde al texto, para poder verificarlo años después', async () => {
    const vigente = await service.textoLegalVigente();

    expect(service.textoNoAlterado(vigente)).toBe(true);
    expect(vigente.hash_texto).toHaveLength(64);
  });

  it('detecta que el texto fue alterado sin actualizar su hash', async () => {
    // Es lo que permite a una autoridad comprobar una constancia sin confiar en
    // el sistema: recalcula el hash sobre el texto y lo compara.
    const vigente = await service.textoLegalVigente();
    await versiones.update(vigente.id, { texto: vigente.texto + ' (alterado)' });

    const alterada = await service.versionPorId(vigente.id);

    expect(service.textoNoAlterado(alterada)).toBe(false);

    await versiones.update(vigente.id, { texto: TEXTO_LEGAL_V1 });
  });

  it('impide que dos versiones estén vigentes a la vez', async () => {
    // Con dos vigentes sería indeterminado qué texto se muestra, y por lo tanto
    // contra qué texto se firmó.
    await expect(
      versiones.save(
        versiones.create({
          version: 'v2-borrador',
          texto: 'Otro texto',
          hash_texto: DeclaracionesService.hashDeTexto('Otro texto'),
          vigente: true,
        }),
      ),
    ).rejects.toThrow();
  });

  it('permite conservar versiones anteriores no vigentes', async () => {
    // Las versiones viejas no se borran: hay declaraciones que las referencian
    // y deben poder reconstruirse tal como se mostraron.
    const anterior = await versiones.save(
      versiones.create({
        version: 'v0-historica',
        texto: 'Texto anterior',
        hash_texto: DeclaracionesService.hashDeTexto('Texto anterior'),
        vigente: false,
      }),
    );

    const recuperada = await service.versionPorId(anterior.id);

    expect(recuperada.texto).toBe('Texto anterior');
    // Y la vigente sigue siendo la que corresponde.
    expect((await service.textoLegalVigente()).version).toBe(VERSION_INICIAL);
  });
});
