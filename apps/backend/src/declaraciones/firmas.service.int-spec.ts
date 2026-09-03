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
import { verificarCadena } from './domain/cadena';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { NivelConfianza, EstadoDenuncia } from '../denuncias/domain/estados';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { RefreshToken } from '../users/entities/refresh-token.entity';
import { ReputationEvent } from '../users/entities/reputation-event.entity';

const NOMBRE = 'María Fernanda Villarroel Quispe';

describe('Acto de firma de la declaración jurada (integración)', () => {
  let ctx: ContextoDePruebas;
  let firmas: FirmasService;
  let declaraciones: DeclaracionesService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let registros: Repository<DeclaracionJurada>;
  let versionId: string;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          DeclaracionJurada,
          VersionTextoLegal,
          Denuncia,
          User,
          RefreshToken,
          ReputationEvent,
        ]),
      ],
      providers: [FirmasService, DeclaracionesService, UsersService],
    });
    firmas = ctx.module.get(FirmasService);
    declaraciones = ctx.module.get(DeclaracionesService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    registros = ctx.module.get(getRepositoryToken(DeclaracionJurada));
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

  const crearDenuncia = async (autorId: string) =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: 'b'.repeat(64),
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

  describe('la firma difunde la denuncia', () => {
    it('al firmar, la denuncia pasa a PROVISIONAL con radio y caducidad', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmas.firmar(autor.id, denuncia.id, firmaValida() as never);

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

      await firmas.firmar(
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

      await firmas.firmar(
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
        firmas.firmar(
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
        firmas.firmar(
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
        firmas.firmar(sinDocumento.id, denuncia.id, firmaValida() as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('impide firmar la denuncia de otra persona', async () => {
      const autor = await crearDenunciante();
      const ajeno = await crearDenunciante('ajeno@test.com');
      const denuncia = await crearDenuncia(autor.id);

      await expect(
        firmas.firmar(ajeno.id, denuncia.id, firmaValida() as never),
      ).rejects.toThrow(ForbiddenException);
    });

    it('no permite firmar dos veces la misma denuncia', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmas.firmar(autor.id, denuncia.id, firmaValida() as never);

      await expect(
        firmas.firmar(autor.id, denuncia.id, firmaValida() as never),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('paquete probatorio', () => {
    it('sella la versión del texto legal que se mostró, no «la vigente»', async () => {
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmas.firmar(autor.id, denuncia.id, firmaValida() as never);

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      const version = await declaraciones.versionPorId(versionId);
      expect(registro.version_texto_legal_id).toBe(versionId);
      expect(registro.hash_texto_legal).toBe(version.hash_texto);
    });

    it('la marca temporal la pone el servidor', async () => {
      const antes = Date.now();
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmas.firmar(autor.id, denuncia.id, firmaValida() as never);

      const [registro] = await firmas.deLaDenuncia(denuncia.id);
      expect(registro.firmada_en.getTime()).toBeGreaterThanOrEqual(antes);
      expect(registro.firmada_en.getTime()).toBeLessThanOrEqual(Date.now());
    });

    it('encadena los registros: el segundo apunta al hash del primero', async () => {
      const primero = await crearDenunciante('uno@test.com');
      const segundo = await crearDenunciante('dos@test.com');
      const d1 = await crearDenuncia(primero.id);
      const d2 = await crearDenuncia(segundo.id);

      await firmas.firmar(primero.id, d1.id, firmaValida() as never);
      await firmas.firmar(segundo.id, d2.id, firmaValida() as never);

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

      await firmas.firmar(primero.id, d1.id, firmaValida() as never);
      await firmas.firmar(segundo.id, d2.id, firmaValida() as never);

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
        hash_registro: r.hash_registro,
      }));

      expect(verificarCadena(paraVerificar)).toBeNull();
    });

    it('sella el contenido de la denuncia en ese instante', async () => {
      // Si la denuncia cambiara después, este hash dejaría de corresponder. Por
      // eso la edición se cierra al firmar.
      const autor = await crearDenunciante();
      const denuncia = await crearDenuncia(autor.id);

      await firmas.firmar(autor.id, denuncia.id, firmaValida() as never);

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
      await firmas.firmar(autor.id, denuncia.id, firmaValida() as never);
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
        firmas.firmar(otro.id, otraDenuncia.id, firmaValida() as never),
      ).resolves.toBeTruthy();

      expect((await firmas.verificarCadenaCompleta()).registros).toBe(2);
    });
  });

  describe('verificación de la cadena completa', () => {
    it('una cadena recién construida está intacta', async () => {
      const uno = await crearDenunciante('uno@test.com');
      const dos = await crearDenunciante('dos@test.com');
      await firmas.firmar(uno.id, (await crearDenuncia(uno.id)).id, firmaValida() as never);
      await firmas.firmar(dos.id, (await crearDenuncia(dos.id)).id, firmaValida() as never);

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
});
