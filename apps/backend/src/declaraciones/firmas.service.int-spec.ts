import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { FirmasService } from './firmas.service';
import { DeclaracionesService } from './declaraciones.service';
import { DeclaracionJurada } from './entities/declaracion-jurada.entity';
import { VersionTextoLegal } from './entities/version-texto-legal.entity';
import { VinculoDeclarado } from './domain/vinculos';
import { calcularHashContenido, verificarCadena } from './domain/cadena';
import { mensajeAFirmar, mensajeDeProlongacion } from './domain/firma-dispositivo';
import { ClaveDispositivo } from './entities/clave-dispositivo.entity';
import { Prolongacion } from './entities/prolongacion.entity';
import { contenidoSellable } from '../denuncias/domain/contenido-sellado';
import { TelefonoDePrueba, telefonoDePrueba } from '../../test/setup/telefono-de-prueba';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { NivelConfianza, EstadoDenuncia } from '../denuncias/domain/estados';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { EstadoCuenta } from '../users/domain/estado-cuenta';
import { AlertasService } from '../alertas/alertas.service';
import { SancionesService } from '../sanciones/sanciones.service';
import { Falta } from '../sanciones/entities/falta.entity';
import { Cierre } from '../cierres/entities/cierre.entity';
import { PasarelaPush, PasarelaPushSimulada } from '../alertas/pasarela-push';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { EntregaAlerta } from '../alertas/entities/entrega-alerta.entity';
import { Dispositivo } from '../alertas/entities/dispositivo.entity';

const NOMBRE = 'María Fernanda Villarroel Quispe';

describe('Acto de firma de la declaración jurada (integración)', () => {
  let ctx: ContextoDePruebas;
  let firmas: FirmasService;
  let declaraciones: DeclaracionesService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let registros: Repository<DeclaracionJurada>;
  let emisiones: Repository<EmisionAlerta>;
  let faltas: Repository<Falta>;
  let versionId: string;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          DeclaracionJurada,
          VersionTextoLegal,
          ClaveDispositivo,
          Denuncia,
          User,
          RefreshToken,
          EmisionAlerta,
          EntregaAlerta,
          Dispositivo,
          Falta,
          Cierre,
        ]),
      ],
      providers: [
        FirmasService,
        DeclaracionesService,
        UsersService,
        AlertasService,
        SancionesService,
        { provide: PasarelaPush, useClass: PasarelaPushSimulada },
      ],
    });
    firmas = ctx.module.get(FirmasService);
    declaraciones = ctx.module.get(DeclaracionesService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    registros = ctx.module.get(getRepositoryToken(DeclaracionJurada));
    emisiones = ctx.module.get(getRepositoryToken(EmisionAlerta));
    faltas = ctx.module.get(getRepositoryToken(Falta));
    versionId = (await declaraciones.textoLegalVigente()).id;
  });

  afterAll(async () => {
    await ctx.cerrar();
  });

  beforeEach(async () => {
    await ctx.limpiar();
  });

  /**
   * Cada cuenta necesita su propio hash de documento: la columna es única
   * porque un documento identifica a una sola persona.
   */
  const crearDenunciante = async (email = 'firmante@test.com') =>
    usuarios.save(
      usuarios.create({
        full_name: NOMBRE,
        nombre_documento: NOMBRE,
        email,
        password_hash: 'x',
        documento_registrado: true,
        ci_hash: createHash('sha256').update(email).digest('hex'),
      }),
    );

  /**
   * Cada denuncia busca a una persona distinta: un mismo autor no puede tener
   * dos denuncias abiertas sobre la misma persona.
   */
  let personas = 0;
  const crearDenuncia = async (autorId: string) =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: createHash('sha256').update(`buscada-${++personas}`).digest('hex'),
        description: 'Visto por última vez el martes en la plaza',
        latitude: -16.5,
        longitude: -68.15,
        nivel_confianza: NivelConfianza.REGISTRADA,
        estado: EstadoDenuncia.ACTIVA,
      }),
    );

  const firmaValida = (extra: Partial<Record<string, string>> = {}) => ({
    version_texto_legal_id: versionId,
    vinculo_declarado: VinculoDeclarado.PADRE,
    nombre_escrito: NOMBRE,
    device_id: 'dispositivo-de-prueba',
    ...extra,
  });

  /** Un teléfono por cuenta, como en la app. */
  const telefonos = new Map<string, TelefonoDePrueba>();
  const telefonoDe = (usuarioId: string) => {
    if (!telefonos.has(usuarioId)) telefonos.set(usuarioId, telefonoDePrueba());
    return telefonos.get(usuarioId)!;
  };

  /** Lo que firmaría el teléfono para esta denuncia y esta declaración. */
  const mensajePara = async (denunciaId: string, payload: Record<string, string>) => {
    const denuncia = await denuncias
      .createQueryBuilder('d')
      .addSelect('d.ci_hash_persona_buscada')
      .where('d.id = :id', { id: denunciaId })
      .getOne();
    const version = await ctx.dataSource
      .getRepository(VersionTextoLegal)
      .findOneBy({ id: payload.version_texto_legal_id });
    return mensajeAFirmar({
      denuncia_id: denunciaId,
      hash_contenido_denuncia: denuncia
        ? calcularHashContenido(contenidoSellable(denuncia), denuncia.version_formula_contenido)
        : '',
      hash_texto_legal: version?.hash_texto ?? '',
      vinculo_declarado: payload.vinculo_declarado,
      texto_firmado: payload.nombre_escrito,
    });
  };

  /**
   * Firma como lo hace la app: registra la clave de su teléfono y firma lo
   * declarado. Arma el mensaje por su cuenta, sin pasar por las comprobaciones
   * de `contenidoAFirmar`, para que cada prueba de rechazo ejercite las de
   * `firmar`.
   */
  const firmar = async (usuarioId: string, denunciaId: string, payload: Record<string, string>) => {
    const telefono = telefonoDe(usuarioId);
    const { id } = await firmas.registrarClave(usuarioId, telefono.clavePublica);
    return firmas.firmar(usuarioId, denunciaId, {
      ...payload,
      clave_dispositivo_id: id,
      firma_dispositivo: telefono.firmar(await mensajePara(denunciaId, payload)),
    } as never);
  };

  describe('la firma difunde la denuncia', () => {
    it('al firmar, la denuncia pasa a PROVISIONAL con radio y caducidad', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmar(autor.id, denuncia.id, firmaValida() as never);

      const despues = await denuncias.findOneByOrFail({ id: denuncia.id });
      expect(despues.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
      expect(despues.radio_actual_m).toBe(2000);
      expect(despues.expira_en).toBeInstanceOf(Date);
    });

    it('un tercero no familiar entra con menos alcance y menos plazo, no rechazado', async () => {
      // Muchas desapariciones reales las reportan compañeros de cuarto o
      // personal de instituciones de acogida: son los casos más vulnerables.
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmar(
        autor.id,
        denuncia.id,
        firmaValida({
          vinculo_declarado: VinculoDeclarado.TERCERO_NO_FAMILIAR,
        }) as never,
      );

      const despues = await denuncias.findOneByOrFail({ id: denuncia.id });
      expect(despues.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
      expect(despues.radio_actual_m).toBe(1000);
    });

    it('guarda literal lo que la persona escribió', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);
      const comoLoEscribio = '  MARÍA   fernanda Villarroel QUISPE ';

      await firmar(
        autor.id,
        denuncia.id,
        firmaValida({ nombre_escrito: comoLoEscribio }) as never,
      );

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      expect(registro.texto_firmado).toBe(comoLoEscribio);
    });
  });

  describe('comprobación del nombre escrito', () => {
    it('acepta el nombre sin tildes y con mayúsculas distintas', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await expect(
        firmar(
          autor.id,
          denuncia.id,
          firmaValida({ nombre_escrito: 'maria fernanda villarroel quispe' }) as never,
        ),
      ).resolves.toBeTruthy();
    });

    it('rechaza un nombre incompleto: se firma con el nombre entero', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await expect(
        firmar(
          autor.id,
          denuncia.id,
          firmaValida({ nombre_escrito: 'María Villarroel' }) as never,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza a quien no tiene documento registrado', async () => {
      const sinDocumento = await usuarios.save(
        usuarios.create({
          full_name: 'Sin Documento',
          email: 'sindoc@test.com',
          password_hash: 'x',
          documento_registrado: false,
        }),
      );
      const denuncia = await crearDenuncia(sinDocumento.id);

      await expect(
        firmar(sinDocumento.id, denuncia.id, firmaValida() as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('impide firmar la denuncia de otra persona', async () => {
      const autor = await crearDenunciante();
      const ajeno = await crearDenunciante('ajeno@test.com');
      const denuncia = await crearDenuncia(autor.id);

      await expect(
        firmar(ajeno.id, denuncia.id, firmaValida() as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('no permite firmar dos veces la misma denuncia', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmar(autor.id, denuncia.id, firmaValida() as never);

      await expect(
        firmar(autor.id, denuncia.id, firmaValida() as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('paquete probatorio', () => {
    it('sella la versión del texto legal que se mostró, no «la vigente»', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmar(autor.id, denuncia.id, firmaValida() as never);

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      const version = await declaraciones.versionPorId(versionId);
      expect(registro.version_texto_legal_id).toBe(versionId);
      expect(registro.hash_texto_legal).toBe(version.hash_texto);
    });

    it('la marca temporal la pone el servidor', async () => {
      const antes = Date.now();
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmar(autor.id, denuncia.id, firmaValida() as never);

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      expect(registro.firmada_en.getTime()).toBeGreaterThanOrEqual(antes);
      expect(registro.firmada_en.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('encadena los registros: el segundo apunta al hash del primero', async () => {
      const primero = await crearDenunciante('uno@test.com');
      const segundo = await crearDenunciante('dos@test.com');
      const d1 = await crearDenuncia(primero.id);
      const d2 = await crearDenuncia(segundo.id);

      await firmar(primero.id, d1.id, firmaValida() as never);
      await firmar(segundo.id, d2.id, firmaValida() as never);

      const cadena = await registros.find({ order: { firmada_en: 'ASC' } });
      expect(cadena).toHaveLength(2);
      expect(cadena[0].hash_anterior).toBeNull();
      expect(cadena[1].hash_anterior).toBe(cadena[0].hash_registro);
    });

    it('la cadena almacenada se verifica sin errores', async () => {
      const primero = await crearDenunciante('uno@test.com');
      const segundo = await crearDenunciante('dos@test.com');
      const d1 = await crearDenuncia(primero.id);
      const d2 = await crearDenuncia(segundo.id);

      await firmar(primero.id, d1.id, firmaValida() as never);
      await firmar(segundo.id, d2.id, firmaValida() as never);

      const cadena = await registros.find({ order: { firmada_en: 'ASC' } });
      const paraVerificar = cadena.map((r) => ({
        denuncia_id: r.denuncia_id,
        usuario_id: r.usuario_id,
        ci_hash_declarante: r.ci_hash_declarante,
        vinculo_declarado: r.vinculo_declarado,
        tipo: r.tipo,
        version_texto_legal_id: r.version_texto_legal_id,
        hash_texto_legal: r.hash_texto_legal,
        texto_firmado: r.texto_firmado,
        hash_contenido_denuncia: r.hash_contenido_denuncia,
        firmada_en: r.firmada_en.toISOString(),
        device_id: r.device_id,
        hash_anterior: r.hash_anterior,
        clave_publica_id: r.clave_publica_id,
        firma_criptografica: r.firma_criptografica,
        hash_registro: r.hash_registro,
      }));

      expect(verificarCadena(paraVerificar)).toBeNull();
    });

    it('sella el contenido de la denuncia en ese instante', async () => {
      // Si la denuncia cambiara después, este hash dejaría de corresponder. Por
      // eso la edición se cierra al firmar.
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmar(autor.id, denuncia.id, firmaValida() as never);

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      expect(registro.hash_contenido_denuncia).toHaveLength(64);
    });
  });

  /**
   * Invariante I4: el paquete probatorio es append-only.
   *
   * Lo impone un disparador de la base, no la disciplina del código: un
   * invariante que solo sostiene quien escribe se rompe en el primer refactor, y
   * aquí lo que está en juego es que el registro sea creíble incluso frente a
   * quien opera el servidor.
   */
  describe('append-only del paquete probatorio', () => {
    const firmarUna = async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);
      await firmar(autor.id, denuncia.id, firmaValida() as never);
      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      return { registro, denuncia };
    };

    it('rechaza modificar una declaración ya firmada', async () => {
      const { registro } = await firmarUna();

      await expect(
        registros.query(
          `UPDATE declaraciones_juradas SET vinculo_declarado = 'MADRE' WHERE id = $1`,
          [registro.id],
        ),
      ).rejects.toThrow(/solo inserción/i);
    });

    it('rechaza modificar el hash para encubrir una alteración', async () => {
      const { registro } = await firmarUna();

      await expect(
        registros.query(
          `UPDATE declaraciones_juradas SET hash_registro = $2 WHERE id = $1`,
          [registro.id, 'f'.repeat(64)],
        ),
      ).rejects.toThrow(/solo inserción/i);
    });

    it('rechaza eliminar una declaración', async () => {
      const { registro } = await firmarUna();

      await expect(
        registros.query(`DELETE FROM declaraciones_juradas WHERE id = $1`, [
          registro.id,
        ]),
      ).rejects.toThrow(/solo inserción/i);
    });

    it('impide borrar la denuncia para arrastrar su declaración', async () => {
      // El camino indirecto: si la denuncia se pudiera borrar en cascada, el
      // paquete probatorio desaparecería sin tocar la tabla protegida.
      const { denuncia } = await firmarUna();

      await expect(
        registros.query(`DELETE FROM denuncias WHERE id = $1`, [denuncia.id]),
      ).rejects.toThrow();
    });

    it('la declaración sigue ahí tras los intentos fallidos', async () => {
      const { registro } = await firmarUna();

      try {
        await registros.query(`DELETE FROM declaraciones_juradas WHERE id = $1`, [
          registro.id,
        ]);
      } catch {
        // Se espera que falle: lo que se comprueba es que la fila sobrevive.
      }

      const [fila] = await registros.query(
        `SELECT vinculo_declarado FROM declaraciones_juradas WHERE id = $1`,
        [registro.id],
      );
      expect(fila.vinculo_declarado).toBe(VinculoDeclarado.PADRE);
    });

    it('sí permite insertar: corregir es firmar de nuevo, no editar', async () => {
      await firmarUna();
      const otro = await crearDenunciante('otro@test.com');
      const otraDenuncia = await crearDenuncia(otro.id);

      await expect(
        firmar(otro.id, otraDenuncia.id, firmaValida() as never),
      ).resolves.toBeTruthy();

      expect((await firmas.verificarCadenaCompleta()).registros).toBe(2);
    });
  });

  describe('verificación de la cadena completa', () => {
    it('una cadena recién construida está intacta', async () => {
      const uno = await crearDenunciante('uno@test.com');
      const dos = await crearDenunciante('dos@test.com');
      await firmar(uno.id, (await crearDenuncia(uno.id)).id, firmaValida() as never);
      await firmar(dos.id, (await crearDenuncia(dos.id)).id, firmaValida() as never);

      const resultado = await firmas.verificarCadenaCompleta();

      expect(resultado.intacta).toBe(true);
      expect(resultado.registros).toBe(2);
      expect(resultado.primerEslabonRoto).toBeNull();
    });

    it('una cadena vacía está intacta: todavía no hay nada que verificar', async () => {
      const resultado = await firmas.verificarCadenaCompleta();

      expect(resultado.intacta).toBe(true);
      expect(resultado.registros).toBe(0);
    });
  });

  /**
   * H6.3: toda declaración nueva lleva la firma Ed25519 del teléfono, y el
   * servidor la verifica antes de sellar nada.
   */
  describe('firma del teléfono', () => {
    it('sella la firma y la clave con la declaración, y la cadena las cubre', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmar(autor.id, denuncia.id, firmaValida());

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      expect(registro.firma_criptografica).toMatch(/^[0-9a-f]{128}$/);
      expect(registro.clave_publica_id).not.toBeNull();
      expect((await firmas.verificarCadenaCompleta()).intacta).toBe(true);
    });

    it('rechaza una firma que no corresponde a lo declarado, y no sella nada', async () => {
      // El teléfono firmó un vínculo y la petición declara otro.
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);
      const { id } = await firmas.registrarClave(autor.id, telefonoDe(autor.id).clavePublica);
      const firmado = await mensajePara(denuncia.id, firmaValida());

      await expect(
        firmas.firmar(autor.id, denuncia.id, {
          ...firmaValida({ vinculo_declarado: VinculoDeclarado.MADRE }),
          clave_dispositivo_id: id,
          firma_dispositivo: telefonoDe(autor.id).firmar(firmado),
        } as never),
      ).rejects.toThrow(/no corresponde a esta declaración/);
      expect(await registros.count()).toBe(0);
    });

    it('rechaza la clave de otra cuenta, aunque la firma sea válida para esa clave', async () => {
      const autor = await crearDenunciante();
      const otra = await crearDenunciante('otra@test.com');
      const denuncia = await crearDenuncia(autor.id);
      const { id } = await firmas.registrarClave(otra.id, telefonoDe(otra.id).clavePublica);

      await expect(
        firmas.firmar(autor.id, denuncia.id, {
          ...firmaValida(),
          clave_dispositivo_id: id,
          firma_dispositivo: telefonoDe(otra.id).firmar(await mensajePara(denuncia.id, firmaValida())),
        } as never),
      ).rejects.toThrow(/no está registrada en tu cuenta/);
    });

    it('si la denuncia cambia después de firmarse en el teléfono, la firma ya no vale', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);
      const { id } = await firmas.registrarClave(autor.id, telefonoDe(autor.id).clavePublica);
      const firma = telefonoDe(autor.id).firmar(await mensajePara(denuncia.id, firmaValida()));

      await denuncias.update(denuncia.id, { nombre_persona_buscada: 'Luis Mamani Choque' });

      await expect(
        firmas.firmar(autor.id, denuncia.id, {
          ...firmaValida(),
          clave_dispositivo_id: id,
          firma_dispositivo: firma,
        } as never),
      ).rejects.toThrow(/no corresponde a esta declaración/);
    });

    it('el hash que entrega para firmar es el mismo que queda sellado', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      const { hash_contenido_denuncia } = await firmas.contenidoAFirmar(autor.id, denuncia.id);
      await firmar(autor.id, denuncia.id, firmaValida());

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      expect(registro.hash_contenido_denuncia).toBe(hash_contenido_denuncia);
    });

    it('el hash para firmar solo se entrega al autor, y mientras se pueda firmar', async () => {
      const autor = await crearDenunciante();
      const otra = await crearDenunciante('otra@test.com');
      const denuncia = await crearDenuncia(autor.id);

      await expect(firmas.contenidoAFirmar(otra.id, denuncia.id)).rejects.toThrow(
        ForbiddenException,
      );
      await firmar(autor.id, denuncia.id, firmaValida());
      await expect(firmas.contenidoAFirmar(autor.id, denuncia.id)).rejects.toThrow(
        ConflictException,
      );
    });

    it('registrar la clave es idempotente para su dueño; la misma clave en otra cuenta se rechaza', async () => {
      const autor = await crearDenunciante();
      const otra = await crearDenunciante('otra@test.com');
      const { clavePublica } = telefonoDe(autor.id);

      const primera = await firmas.registrarClave(autor.id, clavePublica);
      const segunda = await firmas.registrarClave(autor.id, clavePublica);

      expect(segunda.id).toBe(primera.id);
      await expect(firmas.registrarClave(otra.id, clavePublica)).rejects.toThrow(ConflictException);
    });

    it('una clave registrada no se puede modificar ni borrar: sus firmas dejarían de verificarse', async () => {
      const autor = await crearDenunciante();
      const { id } = await firmas.registrarClave(autor.id, telefonoDe(autor.id).clavePublica);

      await expect(
        ctx.dataSource.query(`UPDATE claves_dispositivo SET clave_publica = $1 WHERE id = $2`, [
          'f'.repeat(64),
          id,
        ]),
      ).rejects.toThrow(/solo inserción/);
      await expect(
        ctx.dataSource.query(`DELETE FROM claves_dispositivo WHERE id = $1`, [id]),
      ).rejects.toThrow(/solo inserción/);
    });

    it('la base solo acepta claves de 32 bytes en hexadecimal', async () => {
      const autor = await crearDenunciante();

      await expect(
        ctx.dataSource.query(
          `INSERT INTO claves_dispositivo (usuario_id, clave_publica) VALUES ($1, 'no-es-una-clave')`,
          [autor.id],
        ),
      ).rejects.toThrow(/chk_claves_dispositivo_formato/);
    });
  });

  /** Le deja una falta a la cuenta, de hace `dias` días, atada a una denuncia ya cerrada. */
  const darleUnaFalta = async (usuarioId: string, dias: number) => {
    const anterior = await crearDenuncia(usuarioId);
    await denuncias.update(anterior.id, { estado: EstadoDenuncia.INVALIDADA });
    await faltas.insert({
      usuario_id: usuarioId,
      tipo: 'CIERRE_CON_SANCION',
      denuncia_id: anterior.id,
      creada_en: new Date(Date.now() - dias * 24 * 3_600_000),
    });
  };

  /**
   * El régimen de sanciones muerde al firmar, porque firmar es lo que difunde.
   */
  describe('régimen de faltas al firmar', () => {
    it('durante los días de una falta no firma: el rechazo trae su código y no sella nada', async () => {
      const autor = await crearDenunciante('autor@test.com');
      await darleUnaFalta(autor.id, 2);
      const denuncia = await crearDenuncia(autor.id);

      await expect(
        firmar(autor.id, denuncia.id, firmaValida() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'CUENTA_SUSPENDIDA_TEMPORALMENTE' }),
      });

      expect(await registros.count()).toBe(0);
      expect((await denuncias.findOneByOrFail({ id: denuncia.id })).nivel_confianza).toBe(
        NivelConfianza.REGISTRADA,
      );
    });

    it('pasados los días de la falta, firma y difunde con el alcance de siempre (I9)', async () => {
      // Una falta sola nunca quita la facultad de alertar para siempre, ni deja
      // una alerta disminuida: lo que queda es que la próxima falta suspende.
      const autor = await crearDenunciante('autor@test.com');
      await darleUnaFalta(autor.id, 8);
      const denuncia = await crearDenuncia(autor.id);

      const resultado = await firmar(autor.id, denuncia.id, firmaValida() as never);

      expect(resultado.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
      expect((await denuncias.findOneByOrFail({ id: denuncia.id })).radio_actual_m).toBe(2000);
    });

    it('una cuenta suspendida no firma', async () => {
      const autor = await crearDenunciante('autor@test.com');
      await usuarios.update(autor.id, { estado_cuenta: EstadoCuenta.SUSPENDIDA });
      const denuncia = await crearDenuncia(autor.id);

      await expect(
        firmar(autor.id, denuncia.id, firmaValida() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'CUENTA_SUSPENDIDA' }),
      });
    });

    it('no difunde una tercera alerta a la vez', async () => {
      const autor = await crearDenunciante('autor@test.com');
      for (let i = 0; i < 2; i++) {
        const denuncia = await crearDenuncia(autor.id);
        await firmar(autor.id, denuncia.id, firmaValida() as never);
      }
      const tercera = await crearDenuncia(autor.id);

      await expect(
        firmar(autor.id, tercera.id, firmaValida() as never),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'LIMITE_ALERTAS_PROVISIONALES' }),
      });
      expect(await registros.count()).toBe(2);
    });

    it('las vencidas no cuentan para el límite', async () => {
      const autor = await crearDenunciante('autor@test.com');
      const primera = await crearDenuncia(autor.id);
      const segunda = await crearDenuncia(autor.id);
      await firmar(autor.id, primera.id, firmaValida() as never);
      await firmar(autor.id, segunda.id, firmaValida() as never);
      // Vencida aunque el planificador todavía no la haya marcado.
      await denuncias.update(segunda.id, { expira_en: new Date(Date.now() - 60_000) });

      const tercera = await crearDenuncia(autor.id);
      const resultado = await firmar(autor.id, tercera.id, firmaValida() as never);

      expect(resultado.nivel_confianza).toBe(NivelConfianza.PROVISIONAL);
    });

    it('no se firma una sin firmar que su autor ya cerró', async () => {
      const autor = await crearDenunciante('autor@test.com');
      const denuncia = await crearDenuncia(autor.id);
      await denuncias.update(denuncia.id, {
        estado: EstadoDenuncia.CERRADA,
        cerrada_en: new Date(),
      });

      await expect(
        firmar(autor.id, denuncia.id, firmaValida() as never),
      ).rejects.toThrow(ConflictException);
      expect(await registros.count()).toBe(0);
    });
  });

  /**
   * Prolongar mantiene la alerta a la vista sin volver a notificar, y cada vez
   * es una afirmación firmada con el teléfono.
   */
  describe('prolongar la alerta', () => {
    const HORA = 3_600_000;

    const denunciaDifundida = async (vinculo = VinculoDeclarado.PADRE) => {
      const autor = await crearDenunciante('autor@test.com');
      const denuncia = await crearDenuncia(autor.id);
      await firmar(autor.id, denuncia.id, firmaValida({ vinculo_declarado: vinculo }) as never);
      return { autor, denuncia };
    };

    /** Lo que firmaría el teléfono para la prolongación número `numero`. */
    const mensajeDeProlongacionPara = async (denunciaId: string, numero: number) =>
      mensajeDeProlongacion({
        denuncia_id: denunciaId,
        numero: String(numero),
        hash_texto_legal: (await declaraciones.versionPorId(versionId)).hash_texto,
      });

    /**
     * Prolonga como lo hace la app: registra la clave y firma el mensaje de la
     * siguiente prolongación. Con `mensaje`, firma ese otro en su lugar.
     */
    const prolongar = async (usuarioId: string, denunciaId: string, mensaje?: string) => {
      const telefono = telefonoDe(usuarioId);
      const { id } = await firmas.registrarClave(usuarioId, telefono.clavePublica);
      const actual = await denuncias.findOneByOrFail({ id: denunciaId });
      return firmas.prolongar(usuarioId, denunciaId, {
        version_texto_legal_id: versionId,
        clave_dispositivo_id: id,
        firma_dispositivo: telefono.firmar(
          mensaje ?? (await mensajeDeProlongacionPara(denunciaId, actual.prolongaciones + 1)),
        ),
      });
    };

    it('la mantiene a la vista otro plazo, contado desde ahora, sin notificar a nadie', async () => {
      const { autor, denuncia } = await denunciaDifundida();
      // Le queda una hora: el plazo nuevo no se suma a esa hora.
      await denuncias.update(denuncia.id, { expira_en: new Date(Date.now() + HORA) });

      const resultado = await prolongar(autor.id, denuncia.id);

      expect(resultado.prolongaciones).toBe(1);
      expect(resultado.prolongaciones_restantes).toBe(2);
      const despues = await denuncias.findOneByOrFail({ id: denuncia.id });
      expect(despues.prolongaciones).toBe(1);
      expect(despues.expira_en!.getTime()).toBeGreaterThan(Date.now() + 23.9 * HORA);
      expect(despues.expira_en!.getTime()).toBeLessThan(Date.now() + 24.1 * HORA);
      // La única emisión sigue siendo la de la firma, y sigue en camino:
      // prolongar una alerta vigente no le quita la notificación que todavía no
      // salió.
      const deLaDenuncia = await emisiones.find({ where: { denuncia_id: denuncia.id } });
      expect(deLaDenuncia).toHaveLength(1);
      expect(deLaDenuncia[0].estado).toBe('pendiente');
    });

    it('devuelve a la vista una alerta ya vencida', async () => {
      const { autor, denuncia } = await denunciaDifundida();
      await denuncias.update(denuncia.id, {
        estado: EstadoDenuncia.CADUCADA,
        expira_en: new Date(Date.now() - HORA),
      });

      await prolongar(autor.id, denuncia.id);

      expect((await denuncias.findOneByOrFail({ id: denuncia.id })).estado).toBe(
        EstadoDenuncia.ACTIVA,
      );
    });

    it('al devolver a la vista una vencida no suelta la notificación que no alcanzó a salir', async () => {
      // Venció antes de que el worker la enviara: una caída larga, o los datos
      // de demostración. Si siguiera pendiente, saldría ahora, y prolongar
      // promete no notificar.
      const { autor, denuncia } = await denunciaDifundida();
      const reportada = await crearDenunciante('reportada@test.com');
      await emisiones.insert({
        denuncia_id: denuncia.id,
        usuario_objetivo_id: reportada.id,
        radio_m: null,
        motivo: 'coincidencia_documento',
        estado: 'pendiente',
      });
      await denuncias.update(denuncia.id, {
        estado: EstadoDenuncia.CADUCADA,
        expira_en: new Date(Date.now() - HORA),
      });

      await prolongar(autor.id, denuncia.id);

      const difusion = await emisiones.findOneByOrFail({ denuncia_id: denuncia.id, motivo: 'firma' });
      expect(difusion).toMatchObject({ estado: 'completada', destinatarios: 0 });
      expect(difusion.ultimo_error).toMatch(/^revocada: /);
      // El aviso a la persona reportada no es difusión: que la alerta volvió a
      // la vista le sirve para retirarla.
      const aviso = await emisiones.findOneByOrFail({
        denuncia_id: denuncia.id,
        motivo: 'coincidencia_documento',
      });
      expect(aviso.estado).toBe('pendiente');
    });

    it('un tercero no familiar prolonga con su plazo, más corto', async () => {
      const { autor, denuncia } = await denunciaDifundida(VinculoDeclarado.TERCERO_NO_FAMILIAR);

      await prolongar(autor.id, denuncia.id);

      const despues = await denuncias.findOneByOrFail({ id: denuncia.id });
      expect(despues.expira_en!.getTime()).toBeLessThan(Date.now() + 12.1 * HORA);
      expect(despues.radio_actual_m).toBe(1000);
    });

    it('tiene un tope: la cuarta se rechaza', async () => {
      const { autor, denuncia } = await denunciaDifundida();
      for (let i = 0; i < 3; i++) await prolongar(autor.id, denuncia.id);

      await expect(prolongar(autor.id, denuncia.id)).rejects.toThrow(ConflictException);
      expect((await denuncias.findOneByOrFail({ id: denuncia.id })).prolongaciones).toBe(3);
    });

    it('queda firmada, y la firma de una prolongación no sirve para la siguiente', async () => {
      const { autor, denuncia } = await denunciaDifundida();
      const primera = await mensajeDeProlongacionPara(denuncia.id, 1);
      await prolongar(autor.id, denuncia.id, primera);

      // Reenviar la firma de la primera para pedir la segunda.
      await expect(prolongar(autor.id, denuncia.id, primera)).rejects.toThrow(
        BadRequestException,
      );

      const firmadas = await ctx.dataSource.getRepository(Prolongacion).find({
        where: { denuncia_id: denuncia.id },
      });
      expect(firmadas).toHaveLength(1);
      expect(firmadas[0]).toMatchObject({ numero: 1, usuario_id: autor.id });
      expect(firmadas[0].firma_dispositivo).toMatch(/^[0-9a-f]{128}$/);
    });

    it('una firma sobre otra cosa se rechaza y no prolonga nada', async () => {
      const { autor, denuncia } = await denunciaDifundida();

      await expect(
        prolongar(autor.id, denuncia.id, 'cualquier otra cosa'),
      ).rejects.toThrow(BadRequestException);
      expect((await denuncias.findOneByOrFail({ id: denuncia.id })).prolongaciones).toBe(0);
    });

    it('solo quien la presentó puede prolongarla', async () => {
      const { denuncia } = await denunciaDifundida();
      const ajeno = await crearDenunciante('ajeno@test.com');

      await expect(prolongar(ajeno.id, denuncia.id)).rejects.toThrow(ForbiddenException);
    });

    it('no se prolonga una sin firmar, una cerrada por la persona ni una que su autor dio por terminada', async () => {
      const autor = await crearDenunciante('autor@test.com');
      const sinFirmar = await crearDenuncia(autor.id);
      await expect(prolongar(autor.id, sinFirmar.id)).rejects.toThrow(ConflictException);

      const invalidada = await crearDenuncia(autor.id);
      await firmar(autor.id, invalidada.id, firmaValida() as never);
      await denuncias.update(invalidada.id, { estado: EstadoDenuncia.INVALIDADA });
      await expect(prolongar(autor.id, invalidada.id)).rejects.toThrow(ConflictException);

      const terminada = await crearDenuncia(autor.id);
      await firmar(autor.id, terminada.id, firmaValida() as never);
      await denuncias.update(terminada.id, {
        estado: EstadoDenuncia.CERRADA,
        cerrada_en: new Date(),
      });
      await expect(prolongar(autor.id, terminada.id)).rejects.toThrow(ConflictException);
    });

    it('durante los días de una falta no se prolonga', async () => {
      const { autor, denuncia } = await denunciaDifundida();
      await darleUnaFalta(autor.id, 1);

      await expect(prolongar(autor.id, denuncia.id)).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'CUENTA_SUSPENDIDA_TEMPORALMENTE' }),
      });
    });

    it('devolver a la vista una vencida cuenta para el límite de alertas', async () => {
      const autor = await crearDenunciante('autor@test.com');
      const vencida = await crearDenuncia(autor.id);
      await firmar(autor.id, vencida.id, firmaValida() as never);
      await denuncias.update(vencida.id, {
        estado: EstadoDenuncia.CADUCADA,
        expira_en: new Date(Date.now() - HORA),
      });
      for (let i = 0; i < 2; i++) {
        const otra = await crearDenuncia(autor.id);
        await firmar(autor.id, otra.id, firmaValida() as never);
      }

      await expect(prolongar(autor.id, vencida.id)).rejects.toMatchObject({
        response: expect.objectContaining({ codigo: 'LIMITE_ALERTAS_PROVISIONALES' }),
      });
    });

    it('una prolongación no se puede modificar ni borrar: es una firma', async () => {
      const { autor, denuncia } = await denunciaDifundida();
      await prolongar(autor.id, denuncia.id);

      await expect(
        ctx.dataSource.query(`UPDATE prolongaciones SET numero = 2`),
      ).rejects.toThrow(/solo inserción/);
      await expect(ctx.dataSource.query(`DELETE FROM prolongaciones`)).rejects.toThrow(
        /solo inserción/,
      );
    });
  });
});
