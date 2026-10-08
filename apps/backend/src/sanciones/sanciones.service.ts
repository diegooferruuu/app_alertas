import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { Falta, TipoFalta } from './entities/falta.entity';
import { DocumentoBloqueado } from './entities/documento-bloqueado.entity';
import {
  EstadoSancion,
  FuncionRestringida,
  debeSuspenderse,
  estadoSancion,
  fechaLegible,
  finDeSuspensionTemporal,
  funcionesRestringidas,
} from './domain/situacion';
import { restriccion } from './restriccion';
import { Cierre, TipoCierre } from '../cierres/entities/cierre.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { revocarEmisionesPendientes } from '../alertas/revocacion';
import { User } from '../users/entities/user.entity';
import { EstadoCuenta, estaSuspendida } from '../users/domain/estado-cuenta';
import { UsersService } from '../users/users.service';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/** Lo que la persona ve de su propia situación (la Figura 7 del informe). */
export interface SituacionSanciones {
  estado: EstadoSancion;
  /** Sin la denuncia que la originó ni datos de otras personas. */
  faltas: { tipo: TipoFalta; creada_en: Date }[];
  /** Hasta cuándo dura la suspensión temporal de la última falta, si sigue. */
  suspendida_hasta: Date | null;
  funciones_restringidas: FuncionRestringida[];
}

@Injectable()
export class SancionesService {
  private readonly logger = new Logger(SancionesService.name);

  constructor(
    @InjectRepository(Falta)
    private faltas: Repository<Falta>,
    @InjectRepository(Cierre)
    private cierres: Repository<Cierre>,
    private dataSource: DataSource,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  private get config(): DenunciasConfig {
    return this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);
  }

  async situacionDe(userId: string): Promise<SituacionSanciones> {
    const usuario = await this.usersService.findById(userId);
    const faltas = await this.faltas.find({
      where: { usuario_id: userId },
      select: { tipo: true, creada_en: true },
      order: { creada_en: 'ASC' },
    });
    const estado = estadoSancion(estaSuspendida(usuario.estado_cuenta), faltas.length);
    const suspendidaHasta =
      estado === EstadoSancion.CON_FALTA
        ? finDeSuspensionTemporal(
            faltas[faltas.length - 1].creada_en,
            this.config.diasSuspensionTemporal,
          )
        : null;
    return {
      estado,
      faltas: faltas.map((f) => ({ tipo: f.tipo, creada_en: f.creada_en })),
      suspendida_hasta: suspendidaHasta,
      funciones_restringidas: funcionesRestringidas(estado, suspendidaHasta),
    };
  }

  /**
   * Hasta cuándo dura la suspensión temporal de una cuenta, o `null` si no la
   * tiene. Dentro de una transacción, si la hay.
   */
  async suspensionTemporalDe(userId: string, manager?: EntityManager): Promise<Date | null> {
    const repositorio = manager ? manager.getRepository(Falta) : this.faltas;
    const ultima = await repositorio.findOne({
      where: { usuario_id: userId },
      select: { creada_en: true },
      order: { creada_en: 'DESC' },
    });
    return finDeSuspensionTemporal(ultima?.creada_en ?? null, this.config.diasSuspensionTemporal);
  }

  /**
   * Rechaza, con su código y la fecha en que termina, lo que una cuenta no
   * puede hacer mientras dura la suspensión temporal de una falta.
   *
   * `queNoPuede` completa la frase: «registrar denuncias», «firmar
   * declaraciones», «prolongar alertas».
   */
  async verificarSinSuspensionTemporal(
    userId: string,
    queNoPuede: string,
    manager?: EntityManager,
  ): Promise<void> {
    const hasta = await this.suspensionTemporalDe(userId, manager);
    if (hasta) {
      throw restriccion(
        'CUENTA_SUSPENDIDA_TEMPORALMENTE',
        `Una persona declaró falsa una denuncia tuya: hasta el ${fechaLegible(hasta)} no puedes ${queNoPuede}.`,
      );
    }
  }

  /**
   * Rechaza, con su código, una denuncia que la cuenta no puede registrar.
   *
   * El orden importa para el mensaje que se devuelve, no para la seguridad:
   * cualquiera de las cuatro basta para rechazar.
   */
  async verificarPuedeDenunciar(usuario: User, ciHashPersonaBuscada: string): Promise<void> {
    if (estaSuspendida(usuario.estado_cuenta)) {
      throw restriccion(
        'CUENTA_SUSPENDIDA',
        'Tu cuenta está suspendida: no puedes registrar denuncias.',
      );
    }
    await this.verificarSinSuspensionTemporal(usuario.id, 'registrar denuncias');

    // El mensaje no dice por qué está bloqueada. Puede venir de un «Es falsa» o
    // de un «Estoy bien» con bloqueo, y no distinguirlos es lo que impide que el
    // rechazo revele cuál eligió la persona.
    const bloqueada = await this.cierres.exists({
      where: {
        ci_hash_denunciante: usuario.ci_hash!,
        ci_hash_persona_buscada: ciHashPersonaBuscada,
        bloquea_nueva_denuncia: true,
      },
    });
    if (bloqueada) {
      throw restriccion(
        'DENUNCIA_SOBRE_PERSONA_BLOQUEADA',
        'No puedes registrar una denuncia sobre esta persona.',
      );
    }

    // También lo garantiza un índice único parcial de la base. Aquí se comprueba
    // antes para devolver un mensaje claro en el caso normal; el índice cubre
    // el de dos peticiones simultáneas.
    const abierta = await this.dataSource.getRepository(Denuncia).exists({
      where: {
        denunciante_id: usuario.id,
        ci_hash_persona_buscada: ciHashPersonaBuscada,
        estado: In([EstadoDenuncia.ACTIVA, EstadoDenuncia.CADUCADA]),
      },
    });
    if (abierta) throw this.denunciaAbierta();
  }

  /** El rechazo por denuncia ya abierta, también para cuando lo detecta la base. */
  denunciaAbierta() {
    return restriccion(
      'DENUNCIA_ABIERTA_SOBRE_PERSONA',
      'Ya tienes una denuncia sobre esta persona. Búscala en «Mis denuncias»: desde ahí puedes prolongar su alerta o marcar que la encontraron.',
      409,
    );
  }

  /**
   * Lo que produce un cierre «Esta denuncia es falsa», dentro de su transacción.
   *
   * Siempre: una falta, y las alertas de esa cuenta dejan de difundirse ya. Con
   * la primera falta la cuenta queda unos días sin denunciar —eso se deriva de
   * la fecha de la falta, no se guarda—; si es la segunda persona distinta que
   * lo declara, la suspensión es definitiva.
   *
   * La falta es idempotente por su unicidad: si el cierre se reintentara, no se
   * duplica. La suspensión se evalúa con el cierre recién insertado ya visible;
   * contarlo fuera dejaría que dos cierres simultáneos no se vieran entre sí.
   */
  async aplicarCierreConSancion(
    manager: EntityManager,
    datos: { denuncianteId: string; ciHashDenunciante: string; denunciaId: string },
  ): Promise<{ suspendida: boolean }> {
    await manager
      .getRepository(Falta)
      .createQueryBuilder()
      .insert()
      .values({
        usuario_id: datos.denuncianteId,
        tipo: 'CIERRE_CON_SANCION',
        denuncia_id: datos.denunciaId,
      })
      .orIgnore()
      .execute();

    const { personas } = await manager
      .getRepository(Cierre)
      .createQueryBuilder('c')
      .select('COUNT(DISTINCT c.ci_hash_persona_buscada)', 'personas')
      .where('c.ci_hash_denunciante = :ci', { ci: datos.ciHashDenunciante })
      .andWhere('c.tipo_cierre = :tipo', { tipo: TipoCierre.CON_SANCION })
      .getRawOne<{ personas: string }>()
      .then((fila) => fila ?? { personas: '0' });

    const definitiva = debeSuspenderse(
      Number(personas),
      this.config.cierresConSancionParaSuspension,
    );

    if (definitiva) {
      await manager
        .getRepository(User)
        .update(datos.denuncianteId, { estado_cuenta: EstadoCuenta.SUSPENDIDA });
    }

    // Sus otras alertas dejan de difundirse en el mismo acto, sea la suspensión
    // de unos días o la definitiva: una persona acaba de declarar falsa una
    // denuncia de esta cuenta, y seguir alertando con las demás mientras dura
    // la sanción la contradiría. Pasan a CADUCADA: muere la alerta, no el caso.
    // Pasada la suspensión temporal, su autor puede prolongarlas si todavía le
    // quedan prolongaciones.
    const [detenidas]: [Array<{ id: string }>, number] = await manager.query(
      `UPDATE denuncias SET estado = $2
        WHERE denunciante_id = $1
          AND estado = $3
          AND nivel_confianza <> $4
        RETURNING id`,
      [
        datos.denuncianteId,
        EstadoDenuncia.CADUCADA,
        EstadoDenuncia.ACTIVA,
        NivelConfianza.REGISTRADA,
      ],
    );
    const motivo = definitiva
      ? 'la cuenta de quien denunció fue suspendida'
      : 'una persona declaró falsa otra denuncia de esta cuenta';
    for (const { id } of detenidas) {
      await revocarEmisionesPendientes(manager, id, motivo);
    }

    if (!definitiva) {
      this.logger.log(`Falta registrada, suspensión temporal; alertas detenidas: ${detenidas.length}`);
      return { suspendida: false };
    }

    // Bloquea el documento para que la suspensión no se esquive registrándose de
    // nuevo. `orIgnore`: idempotente si ya estaba bloqueado.
    await manager
      .getRepository(DocumentoBloqueado)
      .createQueryBuilder()
      .insert()
      .values({
        ci_hash: datos.ciHashDenunciante,
        usuario_id: datos.denuncianteId,
        motivo: 'dos_personas_declararon_falsas_sus_denuncias',
      })
      .orIgnore()
      .execute();

    this.logger.log(
      `Cuenta suspendida por dos cierres con sanción de personas distintas; alertas detenidas: ${detenidas.length}`,
    );
    return { suspendida: true };
  }
}
