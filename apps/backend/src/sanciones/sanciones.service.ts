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
    return {
      estado,
      faltas: faltas.map((f) => ({ tipo: f.tipo, creada_en: f.creada_en })),
      funciones_restringidas: funcionesRestringidas(estado),
    };
  }

  /** Cuántas faltas tiene una cuenta. Dentro de una transacción, si la hay. */
  async faltasDe(userId: string, manager?: EntityManager): Promise<number> {
    const repositorio = manager ? manager.getRepository(Falta) : this.faltas;
    return repositorio.countBy({ usuario_id: userId });
  }

  /**
   * Rechaza, con su código, una denuncia que la cuenta no puede registrar.
   *
   * El orden importa para el mensaje que se devuelve, no para la seguridad:
   * cualquiera de las tres basta para rechazar.
   */
  async verificarPuedeDenunciar(usuario: User, ciHashPersonaBuscada: string): Promise<void> {
    if (estaSuspendida(usuario.estado_cuenta)) {
      throw restriccion(
        'CUENTA_SUSPENDIDA',
        'Tu cuenta está suspendida: no puedes registrar denuncias.',
      );
    }

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
      'Ya tienes una denuncia sobre esta persona. Para volver a difundirla, registra el número de caso de la FELCC.',
      409,
    );
  }

  /**
   * Lo que produce un cierre «Esta denuncia es falsa», dentro de su transacción.
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

    if (!debeSuspenderse(Number(personas), this.config.cierresConSancionParaSuspension)) {
      return { suspendida: false };
    }

    await manager
      .getRepository(User)
      .update(datos.denuncianteId, { estado_cuenta: EstadoCuenta.SUSPENDIDA });

    // Sus alertas sin caso de la FELCC dejan de difundirse en el mismo acto: dos
    // personas distintas declararon falsas sus denuncias, y seguir alertando
    // con las demás contradiría eso. Las que tienen caso siguen, porque las
    // respalda la Policía y no la palabra de esta cuenta. Pasan a CADUCADA:
    // muere la alerta, no el caso, y el caso de la FELCC todavía la devuelve.
    const [detenidas]: [Array<{ id: string }>, number] = await manager.query(
      `UPDATE denuncias SET estado = $2
        WHERE denunciante_id = $1
          AND estado = $3
          AND nivel_confianza <> $4
          AND (numero_caso_felcc IS NULL OR btrim(numero_caso_felcc) = '')
        RETURNING id`,
      [
        datos.denuncianteId,
        EstadoDenuncia.CADUCADA,
        EstadoDenuncia.ACTIVA,
        NivelConfianza.REGISTRADA,
      ],
    );
    for (const { id } of detenidas) {
      await revocarEmisionesPendientes(manager, id, 'la cuenta de quien denunció fue suspendida');
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
