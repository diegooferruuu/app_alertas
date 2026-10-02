import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  DeclaracionJurada,
  TipoDeclaracion,
} from './entities/declaracion-jurada.entity';
import { ClaveDispositivo } from './entities/clave-dispositivo.entity';
import { FirmarDeclaracionDto } from './dto/firmar-declaracion.dto';
import { DatosFirmados, firmaValida, mensajeAFirmar } from './domain/firma-dispositivo';
import { DeclaracionesService } from './declaraciones.service';
import {
  VinculoDeclarado,
  tieneAlcanceReducido,
} from './domain/vinculos';
import {
  calcularHashContenido,
  calcularHashRegistro,
  contieneSeparador,
  verificarCadena,
} from './domain/cadena';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { contenidoSellable } from '../denuncias/domain/contenido-sellado';
import { NivelConfianza, EstadoDenuncia } from '../denuncias/domain/estados';
import { UsersService } from '../users/users.service';
import { estaSuspendida } from '../users/domain/estado-cuenta';
import { nombreEscritoCoincide } from '../verification/domain/nombres';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';
import { AlertasService } from '../alertas/alertas.service';
import { SancionesService } from '../sanciones/sanciones.service';
import { restriccion } from '../sanciones/restriccion';

/**
 * El acto de firma de una declaración jurada.
 *
 * Es el punto donde una denuncia deja de estar callada y empieza a difundirse,
 * así que concentra las comprobaciones que el diseño no admite saltarse.
 */
@Injectable()
export class FirmasService {
  constructor(
    @InjectRepository(DeclaracionJurada)
    private declaracionesRepository: Repository<DeclaracionJurada>,
    private dataSource: DataSource,
    private declaracionesService: DeclaracionesService,
    private usersService: UsersService,
    private configService: ConfigService,
    private alertasService: AlertasService,
    private sancionesService: SancionesService,
  ) {}

  private get config(): DenunciasConfig {
    return this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);
  }

  /**
   * Alcance y plazo según el vínculo declarado.
   *
   * `TERCERO_NO_FAMILIAR` entra con radio menor y caducidad más corta, nunca con
   * un rechazo: muchas desapariciones reales las reportan compañeros de cuarto o
   * personal de instituciones de acogida, y son los casos más vulnerables.
   */
  private alcanceSegunVinculo(vinculo: VinculoDeclarado): {
    radio_m: number;
    horas: number;
  } {
    const c = this.config;
    return tieneAlcanceReducido(vinculo)
      ? { radio_m: c.radioTerceroNoFamiliarM, horas: c.caducidadTerceroNoFamiliarH }
      : { radio_m: c.radioProvisionalM, horas: c.caducidadProvisionalH };
  }

  /**
   * Comprobaciones de quien firma, antes de abrir la transacción.
   *
   * Devuelve el usuario y la versión del texto para no releerlos después.
   */
  private async validarFirmante(userId: string, dto: FirmarDeclaracionDto) {
    const usuario = await this.usersService.findById(userId);

    if (!usuario.documento_registrado || !usuario.nombre_documento) {
      throw new ForbiddenException(
        'Debes registrar tu documento antes de firmar una declaración jurada',
      );
    }
    // La suspensión cierra la firma, porque firmar es lo que difunde. Lo que
    // restringe una falta se comprueba al firmar, con la denuncia a la vista:
    // depende de si ya tiene el caso de la FELCC.
    if (estaSuspendida(usuario.estado_cuenta)) {
      throw restriccion(
        'CUENTA_SUSPENDIDA',
        'Tu cuenta está suspendida: no puedes firmar declaraciones.',
      );
    }

    // El nombre se compara contra el que quedó registrado con el documento, no
    // contra el que se tecleó al crear la cuenta.
    if (!nombreEscritoCoincide(dto.nombre_escrito, usuario.nombre_documento)) {
      throw new BadRequestException(
        'El nombre escrito no coincide con el de tu documento registrado',
      );
    }
    if (contieneSeparador(dto.nombre_escrito)) {
      throw new BadRequestException('El nombre contiene caracteres no permitidos');
    }

    const version = await this.declaracionesService.versionPorId(
      dto.version_texto_legal_id,
    );

    return { usuario, version };
  }

  /**
   * Registra la clave pública de un teléfono y devuelve su identificador.
   *
   * Idempotente para su dueño: el teléfono la registra antes de cada firma, así
   * que si la base se reinició o la clave nunca llegó, se arregla sola. Una
   * clave ya registrada por otra cuenta se rechaza: las firmas se atribuyen a
   * quien es dueño de la clave.
   */
  async registrarClave(userId: string, clavePublica: string): Promise<{ id: string }> {
    const claves = this.dataSource.getRepository(ClaveDispositivo);
    // `orIgnore` y releer: dos registros simultáneos de la misma clave no pueden
    // terminar en un error de unicidad.
    await claves
      .createQueryBuilder()
      .insert()
      .values({ usuario_id: userId, clave_publica: clavePublica })
      .orIgnore()
      .execute();
    const clave = await claves.findOneOrFail({ where: { clave_publica: clavePublica } });
    if (clave.usuario_id !== userId) {
      throw new ConflictException('Esa clave ya está registrada en otra cuenta');
    }
    return { id: clave.id };
  }

  /**
   * El hash del contenido que se va a sellar, para que el teléfono lo firme.
   *
   * Es el mismo cálculo que hace `firmar`, con la misma función. Si la denuncia
   * cambiara entre esta consulta y la firma, el hash dejaría de coincidir y la
   * firma se rechazaría, que es lo correcto: se habría firmado otra cosa.
   */
  async contenidoAFirmar(
    userId: string,
    denunciaId: string,
  ): Promise<{ hash_contenido_denuncia: string }> {
    const denuncia = await this.denunciaCompleta(this.dataSource.manager, denunciaId);
    if (denuncia.denunciante_id !== userId) {
      throw new ForbiddenException('Solo puedes firmar tus propias denuncias');
    }
    if (
      denuncia.estado !== EstadoDenuncia.ACTIVA ||
      denuncia.nivel_confianza !== NivelConfianza.REGISTRADA
    ) {
      throw new ConflictException('Esta denuncia ya no se puede firmar');
    }
    return { hash_contenido_denuncia: FirmasService.hashContenidoDe(denuncia) };
  }

  private static hashContenidoDe(denuncia: Denuncia): string {
    return calcularHashContenido(
      contenidoSellable(denuncia),
      denuncia.version_formula_contenido,
    );
  }

  /**
   * Comprueba la firma del teléfono antes de sellar nada.
   *
   * Una clave ajena se trata igual que una inexistente. El teléfono registra su
   * clave antes de firmar, así que cualquiera de los dos rechazos significa que
   * hay que volver a intentarlo, no que algo esté perdido.
   */
  private async verificarFirmaDelTelefono(
    manager: EntityManager,
    userId: string,
    dto: FirmarDeclaracionDto,
    firmado: DatosFirmados,
  ): Promise<ClaveDispositivo> {
    const clave = await manager
      .getRepository(ClaveDispositivo)
      .findOne({ where: { id: dto.clave_dispositivo_id } });
    if (!clave || clave.usuario_id !== userId) {
      throw new BadRequestException(
        'La clave de firma de este teléfono no está registrada en tu cuenta. Vuelve a firmar.',
      );
    }
    if (!firmaValida(clave.clave_publica, mensajeAFirmar(firmado), dto.firma_dispositivo)) {
      throw new BadRequestException(
        'La firma del teléfono no corresponde a esta declaración. Vuelve a firmar.',
      );
    }
    return clave;
  }

  /**
   * Sella un registro en la cadena.
   *
   * Debe llamarse dentro de una transacción que ya tomó el cerrojo de la cadena,
   * y con la firma del teléfono ya verificada.
   */
  private async sellar(
    manager: EntityManager,
    datos: {
      denuncia: Denuncia;
      usuario: { id: string; ci_hash: string };
      versionId: string;
      hashTextoLegal: string;
      hashContenido: string;
      vinculo: VinculoDeclarado;
      nombreEscrito: string;
      deviceId: string | null;
      tipo: TipoDeclaracion;
      claveId: string;
      firma: string;
    },
  ): Promise<void> {
    const declaraciones = manager.getRepository(DeclaracionJurada);

    const ultima = await declaraciones
      .createQueryBuilder('d')
      .orderBy('d.firmada_en', 'DESC')
      .addOrderBy('d.id', 'DESC')
      .limit(1)
      .getOne();

    // La marca temporal la pone el servidor, nunca el cliente: es parte de lo
    // que la constancia acredita.
    const firmadaEn = new Date();

    const campos = {
      denuncia_id: datos.denuncia.id,
      usuario_id: datos.usuario.id,
      ci_hash_declarante: datos.usuario.ci_hash,
      vinculo_declarado: datos.vinculo,
      tipo: datos.tipo,
      version_texto_legal_id: datos.versionId,
      hash_texto_legal: datos.hashTextoLegal,
      texto_firmado: datos.nombreEscrito,
      hash_contenido_denuncia: datos.hashContenido,
      firmada_en: firmadaEn.toISOString(),
      device_id: datos.deviceId,
      hash_anterior: ultima?.hash_registro ?? null,
      clave_publica_id: datos.claveId,
      firma_criptografica: datos.firma,
    };

    await declaraciones.insert({
      ...campos,
      tipo: datos.tipo,
      vinculo_declarado: datos.vinculo,
      firmada_en: firmadaEn,
      hash_registro: calcularHashRegistro(campos),
    });
  }

  /** Carga la denuncia con el hash de la persona buscada, que no viaja por defecto. */
  private async denunciaCompleta(
    manager: EntityManager,
    denunciaId: string,
  ): Promise<Denuncia> {
    const denuncia = await manager
      .getRepository(Denuncia)
      .createQueryBuilder('denuncia')
      .addSelect('denuncia.ci_hash_persona_buscada')
      .where('denuncia.id = :id', { id: denunciaId })
      .getOne();

    if (!denuncia) throw new BadRequestException('Denuncia no encontrada');
    return denuncia;
  }

  /**
   * Firma la declaración original y difunde la denuncia.
   *
   * Todo ocurre en una transacción con un cerrojo: la cadena de hashes exige que
   * los registros se sellen en serie. Sin el cerrojo, dos firmas simultáneas
   * leerían el mismo «último registro» y ambas apuntarían al mismo eslabón,
   * dejando la cadena bifurcada y por lo tanto inverificable.
   */
  async firmar(
    userId: string,
    denunciaId: string,
    dto: FirmarDeclaracionDto,
  ): Promise<{ firmada: boolean; nivel_confianza: NivelConfianza }> {
    const { usuario, version } = await this.validarFirmante(userId, dto);
    const vinculo = dto.vinculo_declarado as VinculoDeclarado;

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        FirmasService.CERROJO_CADENA,
      ]);

      const denuncia = await this.denunciaCompleta(manager, denunciaId);

      if (denuncia.denunciante_id !== userId) {
        throw new ForbiddenException('Solo puedes firmar tus propias denuncias');
      }
      if (denuncia.estado !== EstadoDenuncia.ACTIVA) {
        throw new ConflictException(
          `Una denuncia ${denuncia.estado} no puede firmarse`,
        );
      }
      if (denuncia.nivel_confianza !== NivelConfianza.REGISTRADA) {
        throw new ConflictException('Esta denuncia ya fue declarada bajo juramento');
      }

      const conCasoFelcc = Boolean(denuncia.numero_caso_felcc?.trim());

      // Las dos reglas valen solo para lo que se difundiría sin respaldo: con el
      // caso de la FELCC, la Policía ya respalda la denuncia. Se comprueban antes
      // de sellar, para no dejar una declaración firmada sin efecto.
      if (!conCasoFelcc) {
        if ((await this.sancionesService.faltasDe(userId, manager)) > 0) {
          throw restriccion(
            'DIFUSION_REQUIERE_CASO_FELCC',
            'Por tu historial, tus denuncias solo se difunden con el número de caso de la FELCC. Regístralo y vuelve a firmar.',
          );
        }

        // Dentro del cerrojo de la cadena, que serializa todas las firmas: dos
        // firmas simultáneas no pueden pasar ambas el límite.
        const provisionales = await manager
          .getRepository(Denuncia)
          .createQueryBuilder('d')
          .where('d.denunciante_id = :id', { id: userId })
          .andWhere('d.nivel_confianza = :nivel', { nivel: NivelConfianza.PROVISIONAL })
          .andWhere('d.estado = :estado', { estado: EstadoDenuncia.ACTIVA })
          .andWhere('d.expira_en > now()')
          .getCount();
        if (provisionales >= this.config.limiteAlertasProvisionales) {
          throw restriccion(
            'LIMITE_ALERTAS_PROVISIONALES',
            `Ya tienes ${provisionales} alertas sin respaldo difundiéndose. Podrás difundir otra cuando alguna caduque o la respaldes con el número de caso de la FELCC.`,
            409,
          );
        }
      }

      // Lo que firmó el teléfono, armado aquí con los valores del servidor: si
      // el teléfono hubiera firmado otra cosa, la verificación no pasa.
      const hashContenido = FirmasService.hashContenidoDe(denuncia);
      const clave = await this.verificarFirmaDelTelefono(manager, userId, dto, {
        denuncia_id: denuncia.id,
        hash_contenido_denuncia: hashContenido,
        hash_texto_legal: version.hash_texto,
        vinculo_declarado: vinculo,
        texto_firmado: dto.nombre_escrito,
      });

      await this.sellar(manager, {
        denuncia,
        usuario: { id: userId, ci_hash: usuario.ci_hash },
        versionId: version.id,
        hashTextoLegal: version.hash_texto,
        hashContenido,
        vinculo,
        nombreEscrito: dto.nombre_escrito,
        deviceId: dto.device_id ?? null,
        tipo: 'original',
        claveId: clave.id,
        firma: dto.firma_dispositivo,
      });

      // Con el caso de la FELCC ya registrado, la firma y el respaldo ocurren en
      // el mismo acto: son las dos transiciones válidas —REGISTRADA a
      // PROVISIONAL por la firma, PROVISIONAL a CORROBORADA por el respaldo—
      // aplicadas juntas, sin saltarse la firma. Sale una sola emisión, ya con el
      // alcance corroborado: emitir primero a 2 km y enseguida a 10 km avisaría
      // dos veces a los mismos vecinos.
      const nivel = conCasoFelcc ? NivelConfianza.CORROBORADA : NivelConfianza.PROVISIONAL;
      const { radio_m, horas } = conCasoFelcc
        ? { radio_m: this.config.radioCorroboradoM, horas: this.config.caducidadCorroboradaH }
        : this.alcanceSegunVinculo(vinculo);
      const expiraEn = new Date(Date.now() + horas * 3_600_000);

      await manager.getRepository(Denuncia).update(denuncia.id, {
        nivel_confianza: nivel,
        radio_actual_m: radio_m,
        expira_en: expiraEn,
      });

      // Se encola DENTRO de esta transacción, no después. Si el proceso muriera
      // entre firmar y encolar, quedaría una denuncia declarada bajo juramento
      // cuya alerta nunca se emite y de la que nadie se enteraría. Aquí o se
      // guardan las tres cosas —declaración, difusión y trabajo— o ninguna.
      await this.alertasService.encolar(manager, denuncia.id, radio_m, 'firma');

      return { firmada: true, nivel_confianza: nivel };
    });
  }


  /**
   * Amplía el alcance de una denuncia corroborada y vuelve a emitir.
   *
   * Se llama desde dentro de una transacción ya en curso. Al corroborarse, el
   * plazo se cuenta desde ahora: un caso con respaldo merece empezar de nuevo su
   * ventana, no heredar lo que quedaba de la anterior.
   */
  private async ampliarPorCorroboracion(
    manager: EntityManager,
    denuncia: Denuncia,
  ): Promise<void> {
    const { radioCorroboradoM, caducidadCorroboradaH } = this.config;

    await manager.getRepository(Denuncia).update(denuncia.id, {
      nivel_confianza: NivelConfianza.CORROBORADA,
      radio_actual_m: radioCorroboradoM,
      expira_en: new Date(Date.now() + caducidadCorroboradaH * 3_600_000),
      // Reactiva la alerta si había caducado esperando respaldo: muere la
      // alerta, no el caso, y una corroboración tardía es motivo para revivirla.
      estado: EstadoDenuncia.ACTIVA,
    });

    await this.alertasService.encolar(
      manager,
      denuncia.id,
      radioCorroboradoM,
      'corroboracion',
    );
  }

  /**
   * Registra el número de caso de la FELCC: la **única** vía de corroboración.
   *
   * La corroboración por otro usuario se eliminó: dos personas de acuerdo podían
   * respaldar una denuncia falsa, y el respaldo de una autoridad no depende de
   * eso. Aquí no hay declaración jurada porque lo que corrobora el caso es que
   * exista una denuncia formal ante la Policía.
   *
   * Se puede registrar **antes de firmar**: entonces solo se guarda, y la firma
   * difunde la alerta ya respaldada. Es la vía de quien ya tiene el acta en la
   * mano, y la única de quien tiene una falta.
   */
  async registrarCasoFelcc(
    userId: string,
    denunciaId: string,
    numeroCaso: string,
  ): Promise<{ nivel_confianza: NivelConfianza }> {
    return this.dataSource.transaction(async (manager) => {
      const denuncia = await this.denunciaCompleta(manager, denunciaId);

      if (denuncia.denunciante_id !== userId) {
        throw new ForbiddenException(
          'Solo el autor puede registrar el número de caso',
        );
      }
      if (denuncia.nivel_confianza === NivelConfianza.REGISTRADA) {
        if (denuncia.estado !== EstadoDenuncia.ACTIVA) {
          throw new ConflictException(
            `Una denuncia ${denuncia.estado} no admite corroboración`,
          );
        }
        // Todavía no se difunde nada: se guarda el número, y la firma la sacará
        // directamente corroborada.
        await manager.getRepository(Denuncia).update(denuncia.id, {
          numero_caso_felcc: numeroCaso.trim(),
        });
        return { nivel_confianza: NivelConfianza.REGISTRADA };
      }
      if (
        denuncia.estado === EstadoDenuncia.INVALIDADA ||
        denuncia.estado === EstadoDenuncia.CERRADA
      ) {
        throw new ConflictException(
          `Una denuncia ${denuncia.estado} no admite corroboración`,
        );
      }

      await manager.getRepository(Denuncia).update(denuncia.id, {
        numero_caso_felcc: numeroCaso.trim(),
      });

      if (denuncia.nivel_confianza !== NivelConfianza.CORROBORADA) {
        await this.ampliarPorCorroboracion(manager, denuncia);
      }

      return { nivel_confianza: NivelConfianza.CORROBORADA };
    });
  }

  /** Identificador arbitrario pero estable del cerrojo de la cadena. */
  private static readonly CERROJO_CADENA = 828_101;

  /** Declaraciones de una denuncia, en orden de firma. */
  async deLaDenuncia(denunciaId: string): Promise<DeclaracionJurada[]> {
    return this.declaracionesRepository.find({
      where: { denuncia_id: denunciaId },
      order: { firmada_en: 'ASC' },
    });
  }

  /** Convierte una fila en los campos que entran en su hash. */
  private static camposDe(registro: DeclaracionJurada) {
    return {
      denuncia_id: registro.denuncia_id,
      usuario_id: registro.usuario_id,
      ci_hash_declarante: registro.ci_hash_declarante,
      vinculo_declarado: registro.vinculo_declarado,
      tipo: registro.tipo,
      version_texto_legal_id: registro.version_texto_legal_id,
      hash_texto_legal: registro.hash_texto_legal,
      texto_firmado: registro.texto_firmado,
      hash_contenido_denuncia: registro.hash_contenido_denuncia,
      firmada_en: registro.firmada_en.toISOString(),
      device_id: registro.device_id,
      hash_anterior: registro.hash_anterior,
      clave_publica_id: registro.clave_publica_id,
      firma_criptografica: registro.firma_criptografica,
      hash_registro: registro.hash_registro,
    };
  }

  /**
   * Verifica la cadena completa de declaraciones.
   *
   * Detecta tanto un registro alterado como uno suprimido: si falta un eslabón
   * intermedio, el siguiente apunta a un hash que ya no está. Es la operación
   * que sostiene la constancia probatoria de la fase 6, y la que permite a un
   * tercero comprobar el registro sin confiar en quien opera el sistema.
   */
  async verificarCadenaCompleta(): Promise<{
    intacta: boolean;
    registros: number;
    primerEslabonRoto: number | null;
  }> {
    const todas = await this.declaracionesRepository.find({
      order: { firmada_en: 'ASC', id: 'ASC' },
    });

    const roto = verificarCadena(todas.map(FirmasService.camposDe));

    return {
      intacta: roto === null,
      registros: todas.length,
      primerEslabonRoto: roto,
    };
  }
}
