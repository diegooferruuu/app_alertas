import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { DeclaracionesService } from './declaraciones.service';
import { VersionTextoLegal } from './entities/version-texto-legal.entity';
import {
  TEXTO_LEGAL_V1,
  TEXTO_LEGAL_V2,
  TEXTO_LEGAL_V3,
  VERSION_INICIAL,
  VERSION_REGIMEN_FALTAS,
  VERSION_SIN_FELCC,
} from './texto-legal';

/**
 * Las que siembran las migraciones. Ninguna prueba puede borrarlas: si falta
 * una aquí, la limpieza de abajo la borra de la base de pruebas y las demás
 * suites se quedan sin texto vigente.
 */
const SEMBRADAS = [VERSION_INICIAL, VERSION_REGIMEN_FALTAS, VERSION_SIN_FELCC];

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

  it('la migración deja vigente el texto sin la FELCC', async () => {
    const vigente = await service.textoLegalVigente();

    expect(vigente.version).toBe(VERSION_SIN_FELCC);
    expect(vigente.texto).toBe(TEXTO_LEGAL_V3);
    // Lo que se firma no puede prometer consecuencias que el sistema ya no
    // aplica: ni puntaje, ni un número de caso que dé más alcance.
    expect(vigente.texto).not.toMatch(/reputaci[oó]n/i);
    expect(vigente.texto).not.toMatch(/n[uú]mero de caso/i);
    // Y sí describe lo que lo reemplazó.
    expect(vigente.texto).toMatch(/siete días/);
    expect(vigente.texto).toMatch(/prolongar la alerta/);
  });

  it('el texto vigente nombra el vínculo una vez, con el marcador que la app reemplaza por el elegido', async () => {
    // La app pregunta el vínculo antes de mostrar el texto y lo escribe en este
    // lugar. El hash, en cambio, se calcula con el marcador: igual para todos.
    const vigente = await service.textoLegalVigente();

    expect(vigente.texto.split('{{VINCULO}}')).toHaveLength(2);
  });

  it('las versiones anteriores se conservan intactas y ya no vigentes: hay declaraciones firmadas contra ellas', async () => {
    for (const [version, texto] of [
      [VERSION_INICIAL, TEXTO_LEGAL_V1],
      [VERSION_REGIMEN_FALTAS, TEXTO_LEGAL_V2],
    ]) {
      const anterior = await versiones.findOneByOrFail({ version });

      expect(anterior.vigente).toBe(false);
      expect(anterior.texto).toBe(texto);
      expect(service.textoNoAlterado(anterior)).toBe(true);
    }
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
    expect((await service.textoLegalVigente()).version).toBe(VERSION_SIN_FELCC);
  });
});
