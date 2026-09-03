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
import { FirmarDeclaracionDto } from './dto/firmar-declaracion.dto';
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
import { NivelConfianza, EstadoDenuncia } from '../denuncias/domain/estados';
import { UsersService } from '../users/users.service';
import { estaSuspendida } from '../users/domain/estado-cuenta';
import { nombreEscritoCoincide } from '../verification/domain/nombres';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';
import { AlertasService } from '../alertas/alertas.service';

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
   * Comprobaciones comunes a todo acto de firma, original o corroboración.
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
    // Solo la suspensión cierra la firma: firmar es lo que hace difundir. Una
    // cuenta apenas RESTRINGIDA conserva el resto de funciones (§5.4), y firmar
    // una denuncia que ya existía no es crear una nueva.
    if (estaSuspendida(usuario.estado_cuenta)) {
      throw new ForbiddenException('Tu cuenta está suspendida');
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
   * Sella un registro en la cadena.
   *
   * Es el mismo acto para una declaración original y para una corroboración:
   * ambas comprometen igual a quien firma, y por eso comparten paquete
   * probatorio en lugar de vivir en tablas distintas.
   *
   * Debe llamarse dentro de una transacción que ya tomó el cerrojo de la cadena.
   */
  private async sellar(
    manager: EntityManager,
    datos: {
      denuncia: Denuncia;
      usuario: { id: string; ci_hash: string };
      versionId: string;
      hashTextoLegal: string;
      vinculo: VinculoDeclarado;
      nombreEscrito: string;
      deviceId: string | null;
      tipo: TipoDeclaracion;
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
      hash_contenido_denuncia: calcularHashContenido({
        nombre_persona_buscada: datos.denuncia.nombre_persona_buscada,
        ci_hash_persona_buscada: datos.denuncia.ci_hash_persona_buscada,
        description: datos.denuncia.description,
        latitude: datos.denuncia.latitude,
        longitude: datos.denuncia.longitude,
      }),
      firmada_en: firmadaEn.toISOString(),
      device_id: datos.deviceId,
      hash_anterior: ultima?.hash_registro ?? null,
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

      await this.sellar(manager, {
        denuncia,
        usuario: { id: userId, ci_hash: usuario.ci_hash },
        versionId: version.id,
        hashTextoLegal: version.hash_texto,
        vinculo,
        nombreEscrito: dto.nombre_escrito,
        deviceId: dto.device_id ?? null,
        tipo: 'original',
      });

      const { radio_m, horas } = this.alcanceSegunVinculo(vinculo);
      const expiraEn = new Date(Date.now() + horas * 3_600_000);

      await manager.getRepository(Denuncia).update(denuncia.id, {
        nivel_confianza: NivelConfianza.PROVISIONAL,
        radio_actual_m: radio_m,
        expira_en: expiraEn,
      });

      // Se encola DENTRO de esta transacción, no después. Si el proceso muriera
      // entre firmar y encolar, quedaría una denuncia declarada bajo juramento
      // cuya alerta nunca se emite y de la que nadie se enteraría. Aquí o se
      // guardan las tres cosas —declaración, difusión y trabajo— o ninguna.
      await this.alertasService.encolar(manager, denuncia.id, radio_m, 'firma');

      return { firmada: true, nivel_confianza: NivelConfianza.PROVISIONAL };
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

  /** Cuántas corroboraciones lleva una denuncia. Se deriva, no se cuenta aparte. */
  private async corroboracionesDe(
    manager: EntityManager,
    denunciaId: string,
  ): Promise<number> {
    return manager.getRepository(DeclaracionJurada).count({
      where: { denuncia_id: denunciaId, tipo: 'corroboracion' },
    });
  }

  /**
   * Corrobora una denuncia ajena firmando la propia declaración jurada.
   *
   * No es un «me consta» ligero: quien corrobora firma con el mismo peso que
   * quien denunció, y su identidad queda igual de atribuida. Por eso comparte
   * paquete probatorio y el mismo acto de firma.
   */
  async corroborar(
    userId: string,
    denunciaId: string,
    dto: FirmarDeclaracionDto,
  ): Promise<{ corroborada: boolean; nivel_confianza: NivelConfianza }> {
    const { usuario, version } = await this.validarFirmante(userId, dto);
    const vinculo = dto.vinculo_declarado as VinculoDeclarado;

    return this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        FirmasService.CERROJO_CADENA,
      ]);

      const denuncia = await this.denunciaCompleta(manager, denunciaId);

      // Corroborarse a sí mismo no aporta respaldo alguno: es la misma persona
      // diciendo dos veces lo mismo.
      if (denuncia.denunciante_id === userId) {
        throw new ForbiddenException(
          'No puedes corroborar tu propia denuncia: la corroboración es el respaldo de otra persona',
        );
      }
      if (denuncia.nivel_confianza === NivelConfianza.REGISTRADA) {
        throw new ConflictException(
          'Esta denuncia todavía no fue declarada bajo juramento por su autor',
        );
      }
      if (
        denuncia.estado === EstadoDenuncia.INVALIDADA ||
        denuncia.estado === EstadoDenuncia.CERRADA
      ) {
        throw new ConflictException(
          `Una denuncia ${denuncia.estado} no admite corroboración`,
        );
      }

      const yaCorroboro = await manager.getRepository(DeclaracionJurada).count({
        where: { denuncia_id: denunciaId, usuario_id: userId },
      });
      if (yaCorroboro > 0) {
        throw new ConflictException('Ya firmaste una declaración sobre esta denuncia');
      }

      await this.sellar(manager, {
        denuncia,
        usuario: { id: userId, ci_hash: usuario.ci_hash },
        versionId: version.id,
        hashTextoLegal: version.hash_texto,
        vinculo,
        nombreEscrito: dto.nombre_escrito,
        deviceId: dto.device_id ?? null,
        tipo: 'corroboracion',
      });

      const corroboraciones = await this.corroboracionesDe(manager, denunciaId);
      const suficientes = corroboraciones >= this.config.corroboradoresNecesarios;

      if (suficientes && denuncia.nivel_confianza !== NivelConfianza.CORROBORADA) {
        await this.ampliarPorCorroboracion(manager, denuncia);
        return { corroborada: true, nivel_confianza: NivelConfianza.CORROBORADA };
      }

      // Firmó, pero todavía faltan respaldos para ampliar el alcance.
      return { corroborada: false, nivel_confianza: denuncia.nivel_confianza };
    });
  }

  /**
   * Registra el número de caso de la FELCC: la otra vía de corroboración.
   *
   * Aquí no hay declaración jurada porque el respaldo no viene de una persona
   * del sistema sino de una autoridad: lo que corrobora el caso es que exista
   * una denuncia formal, no que alguien más se comprometa.
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
        throw new ConflictException(
          'Firma primero la declaración jurada de esta denuncia',
        );
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
