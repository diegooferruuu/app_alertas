import {
  Injectable,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Desactivacion } from './entities/desactivacion.entity';
import { DocumentoBloqueado } from './entities/documento-bloqueado.entity';
import { sancionPor } from './domain/sancion';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import {
  EstadoDenuncia,
  NivelConfianza,
  puedeTransicionarEstado,
} from '../denuncias/domain/estados';
import { EmisionAlerta } from '../alertas/entities/emision-alerta.entity';
import { User } from '../users/entities/user.entity';
import { ReputationEvent } from '../users/entities/reputation-event.entity';
import { EstadoCuenta } from '../users/domain/estado-cuenta';
import { UsersService } from '../users/users.service';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/** Una denuncia que identifica a quien consulta, tal como puede vérsela. */
export interface DenunciaQueMeIdentifica {
  id: string;
  nombre_persona_buscada: string | null;
  description: string;
  nivel_confianza: NivelConfianza;
  estado: EstadoDenuncia;
  se_esta_difundiendo: boolean;
  /** Si todavía admite el interruptor. Falso en las ya retiradas. */
  puede_retirarse: boolean;
  created_at: Date;
}

/** Lo que ve quien acaba de retirar una alerta sobre sí mismo. */
export interface ResultadoDesactivacion {
  desactivada: true;
  denuncia_id: string;
  mensaje: string;
  constancia_disponible: true;
}

@Injectable()
export class DesactivacionesService {
  private readonly logger = new Logger(DesactivacionesService.name);

  constructor(
    @InjectRepository(Desactivacion)
    private desactivacionesRepository: Repository<Desactivacion>,
    private dataSource: DataSource,
    private usersService: UsersService,
    private configService: ConfigService,
  ) {}

  private get config(): DenunciasConfig {
    return this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);
  }

  /**
   * Denuncias vivas que identifican a la persona autenticada.
   *
   * Es lo que hace accionable el aviso: quien recibe la notificación necesita
   * poder llegar a la denuncia concreta para retirarla. No se devuelve nada del
   * denunciante (invariante I8) —ni su nombre, ni su identificador, ni su
   * documento—: solo lo que se declaró sobre la persona reportada.
   *
   * Incluye las CADUCADAS a propósito. Una denuncia caducada no se está
   * difundiendo, pero puede revivir con una corroboración tardía; ocultarla aquí
   * dejaría a la persona sin forma de apagar algo que va a volver a encenderse.
   *
   * E incluye también las **INVALIDADAS**, las ya retiradas. No para volver a
   * retirarlas —eso es terminal— sino porque la constancia probatoria está
   * disponible de forma indefinida (§6.1) y esta lista es el único sitio desde
   * donde la persona puede llegar a ella. Si desaparecieran al retirarlas, ese
   * derecho quedaría accesible solo durante el instante del retiro.
   */
  async denunciasQueMeIdentifican(
    userId: string,
  ): Promise<DenunciaQueMeIdentifica[]> {
    const usuario = await this.usersService.findById(userId);
    if (!usuario.ci_hash) return [];

    const denuncias = await this.dataSource.getRepository(Denuncia).find({
      where: {
        ci_hash_persona_buscada: usuario.ci_hash,
        estado: In([
          EstadoDenuncia.ACTIVA,
          EstadoDenuncia.CADUCADA,
          EstadoDenuncia.INVALIDADA,
        ]),
      },
      order: { created_at: 'DESC' },
    });

    return denuncias.map((d) => ({
      id: d.id,
      nombre_persona_buscada: d.nombre_persona_buscada,
      description: d.description,
      nivel_confianza: d.nivel_confianza,
      estado: d.estado,
      se_esta_difundiendo:
        d.estado === EstadoDenuncia.ACTIVA &&
        d.nivel_confianza !== NivelConfianza.REGISTRADA,
      puede_retirarse: puedeTransicionarEstado(
        d.estado,
        EstadoDenuncia.INVALIDADA,
      ),
      created_at: d.created_at,
      // Deliberadamente ausente: quién la presentó. Esa identidad solo se
      // entrega por la vía deliberada de la constancia.
    }));
  }

  /**
   * Retira una alerta que identifica a quien la ejecuta.
   *
   * **La única autorización posible** es que el documento registrado de la
   * persona autenticada coincida con el de la persona buscada. No hay rol,
   * permiso ni excepción administrativa que abra esta puerta: si existiera,
   * existiría también la forma de que otro la abriera en su nombre, y el
   * interruptor dejaría de ser una garantía para convertirse en un trámite.
   *
   * Todo ocurre en una transacción. Un retiro a medias —la denuncia invalidada
   * pero la alerta todavía saliendo, o los avistamientos aún visibles— dejaría
   * a la persona expuesta justo en el momento en que pidió dejar de estarlo.
   */
  async desactivar(
    userId: string,
    denunciaId: string,
  ): Promise<ResultadoDesactivacion> {
    const usuario = await this.usersService.findById(userId);

    if (!usuario.documento_registrado || !usuario.ci_hash) {
      throw new ForbiddenException(
        'Registra tu documento de identidad para retirar una alerta que te identifica',
      );
    }

    await this.dataSource.transaction(async (manager) => {
      const denuncias = manager.getRepository(Denuncia);

      const denuncia = await denuncias
        .createQueryBuilder('d')
        // El hash de la persona buscada es `select: false`: hay que pedirlo.
        .addSelect('d.ci_hash_persona_buscada')
        .where('d.id = :id', { id: denunciaId })
        // Bloquea la fila hasta el commit. Sin esto, dos peticiones simultáneas
        // podrían superar ambas la comprobación de estado y dejar dos registros
        // de desactivación para una sola denuncia.
        .setLock('pessimistic_write')
        .getOne();

      if (!denuncia) throw new NotFoundException('Denuncia no encontrada');

      // Comparación de hashes, no de identidades: el sistema no necesita saber
      // quién es esta persona para reconocer que es la reportada.
      if (denuncia.ci_hash_persona_buscada !== usuario.ci_hash) {
        // El mismo error que si no existiera. Distinguir «no existe» de «existe
        // pero no es tuya» convertiría este endpoint en una forma de comprobar
        // si un documento cualquiera está denunciado.
        throw new NotFoundException('Denuncia no encontrada');
      }

      if (denuncia.estado === EstadoDenuncia.INVALIDADA) {
        throw new ConflictException('Esta alerta ya fue retirada');
      }
      if (!puedeTransicionarEstado(denuncia.estado, EstadoDenuncia.INVALIDADA)) {
        throw new ConflictException(
          `Una denuncia ${denuncia.estado} ya no puede retirarse`,
        );
      }

      // 1. La denuncia queda INVALIDADA, que es un estado terminal: ni la
      //    caducidad ni una corroboración tardía pueden devolverla a ACTIVA.
      //    No se borra la fila: la declaración jurada que la respalda es
      //    append-only y debe seguir siendo verificable. Se conservan también
      //    el radio y la caducidad, que son el registro de hasta dónde llegó.
      await denuncias.update(denunciaId, { estado: EstadoDenuncia.INVALIDADA });

      // 2. Se revoca lo que todavía no salió. El worker vuelve a leer el estado
      //    de la denuncia antes de enviar y ya descartaría estos trabajos, pero
      //    dejarlos pendientes le haría reintentar en cada ciclo un envío que
      //    nunca debe ocurrir.
      await manager
        .getRepository(EmisionAlerta)
        .createQueryBuilder()
        .update(EmisionAlerta)
        .set({
          estado: 'completada',
          destinatarios: 0,
          emitida_en: () => 'now()',
          ultimo_error: 'revocada: la persona reportada retiró la alerta',
        })
        .where('denuncia_id = :id', { id: denunciaId })
        .andWhere("estado IN ('pendiente', 'procesando')")
        .execute();

      // 3. Se purgan los avistamientos asociados.
      //
      //    PENDIENTE (fase 5): la entidad de avistamientos todavía no existe, de
      //    modo que hoy no hay nada que purgar. No es un paso opcional —los
      //    avistamientos son precisamente lo que convertiría una denuncia falsa
      //    en una red de rastreo— y debe implementarse aquí, dentro de esta
      //    misma transacción, en el incremento que cree la tabla.

      // 4. Queda el registro: es el rastro de auditoría de la acción y la base
      //    sobre la que se mide la reincidencia.
      const denunciante = await manager.getRepository(User).findOneOrFail({
        where: { id: denuncia.denunciante_id },
        select: { id: true, ci_hash: true },
      });
      // El denunciante registró su documento para poder denunciar, y la
      // restricción de la base garantiza el hash. Nunca es nulo aquí.
      const ciHashDenunciante = denunciante.ci_hash!;

      const desactivaciones = manager.getRepository(Desactivacion);
      await desactivaciones.insert({
        denuncia_id: denunciaId,
        ci_hash_denunciante: ciHashDenunciante,
        ci_hash_persona_buscada: denuncia.ci_hash_persona_buscada,
      });

      // 5. Sanción graduada al denunciante (§5.4, invariante I9).
      //
      //    El recuento se hace DENTRO de la transacción, con la desactivación
      //    recién insertada ya visible: si se contara fuera, una segunda
      //    desactivación simultánea podría no ver a la primera y quedarse ambas
      //    en «primera», sin llegar nunca a suspender.
      const recibidas = await desactivaciones.countBy({
        ci_hash_denunciante: ciHashDenunciante,
      });
      const dirigidas = await desactivaciones.countBy({
        ci_hash_denunciante: ciHashDenunciante,
        ci_hash_persona_buscada: denuncia.ci_hash_persona_buscada,
      });
      const sancion = sancionPor(recibidas, dirigidas);

      // La reputación baja en cada desactivación recibida —refleja el patrón del
      // que luego depende el rol (fase 7)—, con suelo en cero. Es la penalización;
      // la sanción en sí es el cambio de estado de la cuenta.
      await manager.getRepository(ReputationEvent).insert({
        user_id: denuncia.denunciante_id,
        delta: -this.config.penalizacionReputacionDesactivacion,
        reason: `desactivacion:${sancion.razon}`,
        reference_id: denunciaId,
      });
      await manager.query(
        `UPDATE users SET reputation_score = GREATEST(reputation_score - $1, 0) WHERE id = $2`,
        [this.config.penalizacionReputacionDesactivacion, denuncia.denunciante_id],
      );

      // El estado solo escala: `sancionPor` es monótono en el número de
      // desactivaciones, que solo crece, así que nunca degrada una suspensión a
      // restricción. La restricción lleva plazo; la suspensión no.
      const restringidaHasta =
        sancion.estado === EstadoCuenta.RESTRINGIDA
          ? new Date(
              Date.now() +
                this.config.restriccionPrimeraDesactivacionH * 3_600_000,
            )
          : null;
      await manager.getRepository(User).update(denuncia.denunciante_id, {
        estado_cuenta: sancion.estado,
        restringida_hasta: restringidaHasta,
      });

      // Al suspender, se bloquea el documento para impedir el re-registro. Con
      // `orIgnore` es idempotente: otra denuncia del mismo autor que se retire
      // después no falla al intentar bloquear un documento ya bloqueado.
      if (sancion.bloquearDocumento) {
        await manager
          .getRepository(DocumentoBloqueado)
          .createQueryBuilder()
          .insert()
          .values({
            ci_hash: ciHashDenunciante,
            usuario_id: denuncia.denunciante_id,
            motivo: sancion.razon,
          })
          .orIgnore()
          .execute();
      }
    });

    // Sin identificadores de personas: este registro lo lee un operador.
    this.logger.log(`Alerta retirada por la persona reportada: ${denunciaId}`);

    return {
      desactivada: true,
      denuncia_id: denunciaId,
      // El mensaje no nombra a quien denunció ni da pista alguna sobre quién es
      // (I8). Esa identidad existe y está sellada en la declaración jurada, pero
      // se entrega por la vía deliberada de la constancia, no de rebote al
      // pulsar un botón.
      mensaje:
        'La alerta fue retirada y dejó de difundirse. Existe una constancia de esta denuncia, con la identidad de quien la firmó, disponible a tu solicitud.',
      constancia_disponible: true,
    };
  }

  /** Cuántas desactivaciones acumula un denunciante. Base de la sanción (H4.5). */
  async recibidasPor(ciHashDenunciante: string): Promise<number> {
    return this.desactivacionesRepository.count({
      where: { ci_hash_denunciante: ciHashDenunciante },
    });
  }

  /**
   * Cuántas veces se le retiró una denuncia contra esta misma persona.
   *
   * Es la distinción que separa el error de la persecución: dos desactivaciones
   * inconexas admiten lectura de buena fe, dos contra el mismo documento no.
   */
  async reincidenciaDirigida(
    ciHashDenunciante: string,
    ciHashPersonaBuscada: string,
  ): Promise<number> {
    return this.desactivacionesRepository.count({
      where: {
        ci_hash_denunciante: ciHashDenunciante,
        ci_hash_persona_buscada: ciHashPersonaBuscada,
      },
    });
  }
}
