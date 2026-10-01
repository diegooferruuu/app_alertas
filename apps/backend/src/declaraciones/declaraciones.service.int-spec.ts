import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { DeclaracionesService } from './declaraciones.service';
import { VersionTextoLegal } from './entities/version-texto-legal.entity';
import {
  TEXTO_LEGAL_V1,
  TEXTO_LEGAL_V2,
  VERSION_INICIAL,
  VERSION_REGIMEN_FALTAS,
} from './texto-legal';

/** Las que siembran las migraciones. Ninguna prueba puede borrarlas. */
const SEMBRADAS = [VERSION_INICIAL, VERSION_REGIMEN_FALTAS];

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
   * A diferencia de las demás pruebas, aquí no se vacía la tabla: las versiones
   * las siembran las migraciones porque el sistema no puede funcionar sin
   * ellas. Solo se retiran las que crea la propia prueba. Borrar la v1 por no
   * estar vigente probaría un estado que no debe existir: hay declaraciones que
   * la referencian.
   */
  beforeEach(async () => {
    await versiones.delete({ version: Not(In(SEMBRADAS)) });
  });

  it('la migración deja vigente el texto del régimen de faltas', async () => {
    const vigente = await service.textoLegalVigente();

    expect(vigente.version).toBe(VERSION_REGIMEN_FALTAS);
    expect(vigente.texto).toBe(TEXTO_LEGAL_V2);
    // Lo que se firma no puede prometer consecuencias que el sistema ya no aplica.
    expect(vigente.texto).not.toMatch(/reputaci[oó]n/i);
  });

  it('la v1 se conserva intacta y ya no vigente: hay declaraciones firmadas contra ella', async () => {
    const v1 = await versiones.findOneByOrFail({ version: VERSION_INICIAL });

    expect(v1.vigente).toBe(false);
    expect(v1.texto).toBe(TEXTO_LEGAL_V1);
    expect(service.textoNoAlterado(v1)).toBe(true);
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
    try {
      await versiones.update(vigente.id, { texto: vigente.texto + ' (alterado)' });

      const alterada = await service.versionPorId(vigente.id);

      expect(service.textoNoAlterado(alterada)).toBe(false);
    } finally {
      // Se restaura el texto que había y no una constante: cuando cambió la
      // versión vigente, restaurar «la v1» dejó la v2 con el texto equivocado.
      await versiones.update(vigente.id, { texto: vigente.texto });
    }
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
    expect((await service.textoLegalVigente()).version).toBe(VERSION_REGIMEN_FALTAS);
  });
});
