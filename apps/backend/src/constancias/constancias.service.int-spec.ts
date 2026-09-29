import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { crearContexto, ContextoDePruebas } from '../../test/setup/contexto';
import { ConstanciasService } from './constancias.service';
import { SolicitudConstancia } from './entities/solicitud-constancia.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { contenidoSellable } from '../denuncias/domain/contenido-sellado';
import { DeclaracionJurada } from '../declaraciones/entities/declaracion-jurada.entity';
import { VersionTextoLegal } from '../declaraciones/entities/version-texto-legal.entity';
import {
  calcularHashRegistro,
  calcularHashContenido,
} from '../declaraciones/domain/cadena';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';

const LA_PAZ = { lat: -16.5, lng: -68.15 };
const hashDe = (ci: string) => createHash('sha256').update(ci).digest('hex');

/**
 * H6.1 — La constancia como acto deliberado y auditado.
 *
 * Lo que se comprueba aquí no es el formato del documento (eso es H6.2) sino el
 * derecho y su puerta: quién puede pedirla, qué recibe cada quien, y que cada
 * entrega quede registrada.
 */
describe('Constancia probatoria · solicitud (integración)', () => {
  let ctx: ContextoDePruebas;
  let servicio: ConstanciasService;
  let usuarios: Repository<User>;
  let denuncias: Repository<Denuncia>;
  let declaraciones: Repository<DeclaracionJurada>;
  let solicitudes: Repository<SolicitudConstancia>;

  beforeAll(async () => {
    ctx = await crearContexto({
      imports: [
        TypeOrmModule.forFeature([
          SolicitudConstancia,
          Denuncia,
          DeclaracionJurada,
          VersionTextoLegal,
          User,
        ]),
      ],
      providers: [ConstanciasService, UsersService],
    });
    servicio = ctx.module.get(ConstanciasService);
    usuarios = ctx.module.get(getRepositoryToken(User));
    denuncias = ctx.module.get(getRepositoryToken(Denuncia));
    declaraciones = ctx.module.get(getRepositoryToken(DeclaracionJurada));
    solicitudes = ctx.module.get(getRepositoryToken(SolicitudConstancia));
  });

  afterAll(async () => ctx.cerrar());
  beforeEach(async () => ctx.limpiar());

  const crearUsuario = async (email: string, ci: string, nombre: string) =>
    usuarios.save(
      usuarios.create({
        full_name: nombre,
        email,
        password_hash: 'x',
        documento_registrado: true,
        ci_hash: hashDe(ci),
        nombre_documento: nombre,
      }),
    );

  const crearDenuncia = async (autorId: string, ciBuscada: string) =>
    denuncias.save(
      denuncias.create({
        denunciante_id: autorId,
        nombre_persona_buscada: 'Luis Mamani',
        ci_hash_persona_buscada: hashDe(ciBuscada),
        description: 'Visto por última vez el martes',
        latitude: LA_PAZ.lat,
        longitude: LA_PAZ.lng,
        nivel_confianza: NivelConfianza.PROVISIONAL,
        estado: EstadoDenuncia.ACTIVA,
        radio_actual_m: 2000,
        expira_en: new Date(Date.now() + 86_400_000),
      }),
    );

  /**
   * Una declaración jurada sellada **de verdad**, con los mismos hashes que
   * produce el acto de firmar.
   *
   * Es lo que permite afirmar algo sobre la verificabilidad: con hashes de
   * relleno, una prueba de «la constancia se puede verificar» no probaría nada.
   */
  const firmar = async (
    denunciaId: string,
    usuarioId: string,
    ci: string,
    opciones: {
      tipo?: 'original' | 'corroboracion';
      vinculo?: string;
      texto?: string;
      firmaCripto?: string | null;
    } = {},
  ) => {
    const [version] = await ctx.dataSource.query(
      `SELECT id, texto FROM versiones_texto_legal WHERE vigente = true LIMIT 1`,
    );
    const denuncia = await denuncias
      .createQueryBuilder('d')
      .addSelect('d.ci_hash_persona_buscada')
      .where('d.id = :id', { id: denunciaId })
      .getOneOrFail();

    const firmadaEn = new Date();
    const campos = {
      denuncia_id: denunciaId,
      usuario_id: usuarioId,
      ci_hash_declarante: hashDe(ci),
      vinculo_declarado: opciones.vinculo ?? 'MADRE',
      tipo: opciones.tipo ?? 'original',
      version_texto_legal_id: version.id,
      hash_texto_legal: createHash('sha256')
        .update(version.texto, 'utf8')
        .digest('hex'),
      texto_firmado: opciones.texto ?? 'Ana Quispe',
      hash_contenido_denuncia: calcularHashContenido(
        contenidoSellable(denuncia),
        denuncia.version_formula_contenido,
      ),
      firmada_en: firmadaEn.toISOString(),
      device_id: null as string | null,
      hash_anterior: null as string | null,
    };

    return declaraciones.save(
      declaraciones.create({
        ...campos,
        vinculo_declarado: campos.vinculo_declarado as any,
        firmada_en: firmadaEn,
        firma_criptografica: opciones.firmaCripto ?? null,
        hash_registro: calcularHashRegistro(campos),
      }),
    );
  };

  describe('autorización', () => {
    it('la persona reportada recibe la identidad de quien la denunció', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');

      const constancia = await servicio.solicitar(luis.id, denuncia.id);

      expect(constancia.alcance).toBe('completa');
      expect(constancia.firmantes).toHaveLength(1);
      expect(constancia.firmantes[0].nombre).toBe('Ana Quispe');
      expect(constancia.firmantes[0].ci_hash).toBe(hashDe('111'));
      expect(constancia.firmantes[0].vinculo_declarado).toBe('MADRE');
    });

    it('quien firmó accede solo a su propia declaración', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const caro = await crearUsuario('caro@t.bo', '333', 'Caro Vaca');
      await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');
      await firmar(denuncia.id, caro.id, '333', {
        tipo: 'corroboracion',
        texto: 'Caro Vaca',
      });

      const constancia = await servicio.solicitar(ana.id, denuncia.id);

      expect(constancia.alcance).toBe('propia_declaracion');
      expect(constancia.firmantes).toHaveLength(1);
      expect(constancia.firmantes[0].nombre).toBe('Ana Quispe');
      // No ve a quien corroboró: tiene derecho a su copia, no a los demás.
      expect(JSON.stringify(constancia)).not.toContain('Caro Vaca');
      expect(JSON.stringify(constancia)).not.toContain(hashDe('333'));
    });

    it('a un tercero le responde como si la denuncia no existiera', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const ajeno = await crearUsuario('ajeno@t.bo', '999', 'Otra Persona');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');

      await expect(servicio.solicitar(ajeno.id, denuncia.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('exige documento registrado para pedirla', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');
      const sinDocumento = await usuarios.save(
        usuarios.create({
          full_name: 'Sin documento',
          email: 'sindoc@t.bo',
          password_hash: 'x',
          documento_registrado: false,
        }),
      );

      await expect(
        servicio.solicitar(sinDocumento.id, denuncia.id),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('contenido', () => {
    it('la persona reportada ve también a quienes corroboraron', async () => {
      // Corroborar compromete igual que denunciar, así que quien respaldó el
      // caso también queda atribuido frente a la persona reportada.
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const caro = await crearUsuario('caro@t.bo', '333', 'Caro Vaca');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');
      await firmar(denuncia.id, caro.id, '333', {
        tipo: 'corroboracion',
        texto: 'Caro Vaca',
      });

      const constancia = await servicio.solicitar(luis.id, denuncia.id);

      expect(constancia.firmantes).toHaveLength(2);
      expect(constancia.firmantes.map((f) => f.tipo)).toEqual([
        'original',
        'corroboracion',
      ]);
      expect(constancia.firmantes.map((f) => f.nombre)).toContain('Caro Vaca');
    });

    it('conserva literal la frase escrita al firmar', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111', { texto: '  Ana   QUISPE ' });

      const constancia = await servicio.solicitar(luis.id, denuncia.id);

      expect(constancia.firmantes[0].texto_firmado).toBe('  Ana   QUISPE ');
    });

    it('declara si la declaración lleva firma criptográfica', async () => {
      // Sin ella, la integridad se apoya solo en una cadena que construye el
      // propio servidor. Decirlo es parte de ser honesto sobre lo que prueba.
      //
      // Se firman dos denuncias distintas en vez de modificar una: las
      // declaraciones juradas son de solo inserción (I4) y un UPDATE lo rechaza
      // la base — que es exactamente lo que debe pasar.
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');

      const sinFirmar = await crearDenuncia(ana.id, '222');
      await firmar(sinFirmar.id, ana.id, '111');

      const conFirmar = await crearDenuncia(ana.id, '222');
      await firmar(conFirmar.id, ana.id, '111', {
        firmaCripto: 'firma-ed25519-simulada',
      });

      const sinFirma = await servicio.solicitar(luis.id, sinFirmar.id);
      expect(sinFirma.firmantes[0].con_firma_criptografica).toBe(false);

      const conFirma = await servicio.solicitar(luis.id, conFirmar.id);
      expect(conFirma.firmantes[0].con_firma_criptografica).toBe(true);
    });

    it('no entrega constancia de una denuncia que nadie firmó', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');

      await expect(servicio.solicitar(luis.id, denuncia.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /**
   * H6.2 — Autoverificabilidad.
   *
   * Estas pruebas recalculan los hashes **solo con lo que el documento publica**,
   * uniendo los campos con el separador y en el orden que él mismo declara. No
   * usan ningún atajo del servidor: es exactamente lo que haría un tercero.
   */
  describe('documento autoverificable', () => {
    const SEP = '\x1F';
    const sha256 = (t: string) =>
      createHash('sha256').update(t, 'utf8').digest('hex');
    const unir = (obj: any, campos: readonly string[]) =>
      campos.map((c) => obj[c] ?? '').join(SEP);

    const constanciaDeEjemplo = async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');
      return servicio.solicitar(luis.id, denuncia.id);
    };

    it('publica el procedimiento y el orden de los campos', async () => {
      const c = await constanciaDeEjemplo();

      expect(c.formato).toBe('constancia-denuncia/v2');
      expect(c.verificacion.algoritmo).toBe('SHA-256');
      expect(c.verificacion.separador).toBe('U+001F');
      expect(c.verificacion.orden_campos_registro.length).toBeGreaterThan(0);
      expect(c.verificacion.procedimiento.length).toBeGreaterThan(0);
      // El orden de contenido depende de con qué fórmula se selló la denuncia;
      // publicarlo es lo que permite a un verificador único comprobar tanto una
      // constancia vieja como una nueva.
      expect(c.verificacion.version_formula_contenido).toBeGreaterThan(0);
      expect(c.verificacion.orden_campos_contenido.length).toBeGreaterThan(0);
    });

    it('el hash del registro se recalcula desde los campos publicados', async () => {
      const c = await constanciaDeEjemplo();
      const d = c.declaraciones[0];

      const recalculado = sha256(unir(d, c.verificacion.orden_campos_registro));

      expect(recalculado).toBe(d.hash_registro);
    });

    it('el hash del contenido se recalcula desde la denuncia publicada', async () => {
      const c = await constanciaDeEjemplo();

      const recalculado = sha256(
        unir(c.denuncia, c.verificacion.orden_campos_contenido),
      );

      expect(recalculado).toBe(c.declaraciones[0].hash_contenido_denuncia);
    });

    it('incluye el texto legal entero, no una referencia', async () => {
      // Sin el texto no se puede recalcular su hash, y habría que pedirle el
      // original al sistema: justo lo que la constancia existe para evitar.
      const c = await constanciaDeEjemplo();
      const d = c.declaraciones[0];
      const texto = c.textos_legales.find(
        (t) => t.id === d.version_texto_legal_id,
      );

      expect(texto).toBeDefined();
      expect(texto!.texto.length).toBeGreaterThan(100);
      expect(sha256(texto!.texto)).toBe(d.hash_texto_legal);
    });

    it('altera un campo y el hash deja de cuadrar', async () => {
      const c = await constanciaDeEjemplo();
      const d = { ...c.declaraciones[0], vinculo_declarado: 'HERMANO_A' as any };

      const recalculado = sha256(unir(d, c.verificacion.orden_campos_registro));

      expect(recalculado).not.toBe(c.declaraciones[0].hash_registro);
    });

    it('las coordenadas viajan en la forma exacta que se selló', async () => {
      // Como cadena ya redondeada: si viajaran como número, el verificador
      // dependería de cómo su lenguaje imprime un flotante.
      const c = await constanciaDeEjemplo();

      expect(c.denuncia.latitude).toBe('-16.5000000');
      expect(typeof c.denuncia.longitude).toBe('string');
    });

    it('declara con franqueza lo que no demuestra', async () => {
      const c = await constanciaDeEjemplo();

      expect(c.verificacion.limites.length).toBeGreaterThanOrEqual(2);
      expect(c.verificacion.limites.join(' ')).toContain('firma');
    });
  });

  describe('auditoría y disponibilidad', () => {
    it('registra cada solicitud con quién, qué y con qué alcance', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');

      await servicio.solicitar(luis.id, denuncia.id);

      const [registro] = await solicitudes.find();
      expect(registro.denuncia_id).toBe(denuncia.id);
      expect(registro.solicitante_id).toBe(luis.id);
      expect(registro.ci_hash_solicitante).toBe(hashDe('222'));
      expect(registro.alcance).toBe('completa');
      expect(registro.solicitada_en).toBeInstanceOf(Date);
    });

    it('puede pedirse varias veces, y cada entrega queda registrada', async () => {
      // Está disponible de forma indefinida: no se agota en un solo uso.
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');

      await servicio.solicitar(luis.id, denuncia.id);
      await servicio.solicitar(luis.id, denuncia.id);

      expect(await solicitudes.count()).toBe(2);
    });

    it('sigue disponible después de retirar la alerta', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      const luis = await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');
      await denuncias.update(denuncia.id, {
        estado: EstadoDenuncia.INVALIDADA,
      });

      const constancia = await servicio.solicitar(luis.id, denuncia.id);

      expect(constancia.firmantes).toHaveLength(1);
      expect(constancia.denuncia.estado).toBe(EstadoDenuncia.INVALIDADA);
    });

    it('un rechazo no deja rastro de entrega', async () => {
      const ana = await crearUsuario('ana@t.bo', '111', 'Ana Quispe');
      await crearUsuario('luis@t.bo', '222', 'Luis Mamani');
      const ajeno = await crearUsuario('ajeno@t.bo', '999', 'Otra Persona');
      const denuncia = await crearDenuncia(ana.id, '222');
      await firmar(denuncia.id, ana.id, '111');

      try {
        await servicio.solicitar(ajeno.id, denuncia.id);
      } catch {
        // se espera el rechazo
      }

      expect(await solicitudes.count()).toBe(0);
    });
  });
});
