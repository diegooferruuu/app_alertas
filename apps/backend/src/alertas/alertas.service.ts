import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EmisionAlerta, MotivoEmision } from './entities/emision-alerta.entity';
import { EntregaAlerta } from './entities/entrega-alerta.entity';
import { PasarelaPush, MensajePush } from './pasarela-push';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { EstadoDenuncia, NivelConfianza } from '../denuncias/domain/estados';
import { DENUNCIAS_CONFIG, DenunciasConfig } from '../config/denuncias.config';

/** Un destinatario alcanzado por el radio, con el dispositivo donde avisarle. */
interface Destinatario {
  usuario_id: string;
  dispositivo_id: string;
  push_token: string;
  distancia_m: number;
}

@Injectable()
export class AlertasService {
  private readonly logger = new Logger(AlertasService.name);

  constructor(
    @InjectRepository(EmisionAlerta)
    private emisionesRepository: Repository<EmisionAlerta>,
    private dataSource: DataSource,
    private pasarela: PasarelaPush,
    private configService: ConfigService,
  ) {}

  private get config(): DenunciasConfig {
    return this.configService.getOrThrow<DenunciasConfig>(DENUNCIAS_CONFIG);
  }

  /**
   * Encola una emisión dentro de una transacción en curso.
   *
   * Recibe el `EntityManager` de quien la llama a propósito: la fila debe
   * guardarse en la **misma transacción** que la firma que la origina. Si se
   * encolara aparte, un fallo entre una operación y otra dejaría una denuncia
   * firmada cuya alerta nunca se emite, y nadie se enteraría.
   */
  async encolar(
    manager: EntityManager,
    denunciaId: string,
    radioM: number,
    motivo: MotivoEmision,
  ): Promise<void> {
    await manager.getRepository(EmisionAlerta).insert({
      denuncia_id: denunciaId,
      radio_m: radioM,
      motivo,
      estado: 'pendiente',
    });
  }

  /**
   * Encola el aviso directo a la persona que una denuncia identifica.
   *
   * Va en la misma transacción que la creación de la denuncia, por el mismo
   * motivo que la difusión: si se encolara aparte, un fallo entre una operación
   * y otra dejaría a alguien reportado sin enterarse nunca, que es justo lo que
   * el interruptor de desactivación existe para evitar.
   */
  async encolarAvisoDirecto(
    manager: EntityManager,
    denunciaId: string,
    usuarioObjetivoId: string,
  ): Promise<void> {
    await manager.getRepository(EmisionAlerta).insert({
      denuncia_id: denunciaId,
      usuario_objetivo_id: usuarioObjetivoId,
      radio_m: null,
      motivo: 'coincidencia_documento',
      estado: 'pendiente',
    });
  }

  /** Dispositivos de una persona concreta, para un aviso directo. */
  private async dispositivosDe(usuarioId: string): Promise<Destinatario[]> {
    return this.dataSource
      .createQueryBuilder()
      .select('d.usuario_id', 'usuario_id')
      .addSelect('d.id', 'dispositivo_id')
      .addSelect('d.push_token', 'push_token')
      // Un aviso directo no depende de dónde esté la persona.
      .addSelect('0', 'distancia_m')
      .from('dispositivos', 'd')
      .where('d.usuario_id = :usuarioId', { usuarioId })
      .getRawMany<Destinatario>();
  }

  /**
   * Quiénes deben recibir la alerta de una denuncia.
   *
   * Tres condiciones, y ninguna es opcional:
   *
   *  - La persona está dentro de `denuncia.radio_actual_m`. El radio es del
   *    caso, no una constante del sistema: cambia al corroborarse, y la consulta
   *    no debe reescribirse cuando eso pasa.
   *  - Su última ubicación es reciente. Opera sobre la posición registrada, no
   *    sobre dónde está ahora; alertar a alguien por una zona que reportó hace
   *    una semana no informa a nadie y falsea la métrica de segmentación.
   *  - No es quien denunció: ya conoce el caso.
   */
  async destinatariosDe(denuncia: Denuncia): Promise<Destinatario[]> {
    const puntoDelCaso = `ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography`;

    return this.dataSource
      .createQueryBuilder()
      .select('u.id', 'usuario_id')
      .addSelect('d.id', 'dispositivo_id')
      .addSelect('d.push_token', 'push_token')
      .addSelect(
        `ROUND(ST_Distance(u.last_location, ${puntoDelCaso}))::int`,
        'distancia_m',
      )
      .from('users', 'u')
      .innerJoin('dispositivos', 'd', 'd.usuario_id = u.id')
      .where('u.last_location IS NOT NULL')
      .andWhere(`ST_DWithin(u.last_location, ${puntoDelCaso}, :radio)`)
      .andWhere(
        `u.last_location_at > now() - make_interval(hours => :antiguedad)`,
      )
      .andWhere('u.id != :autor', { autor: denuncia.denunciante_id })
      .andWhere('u.is_suspended = false')
      .setParameters({
        lat: denuncia.latitude,
        lng: denuncia.longitude,
        radio: denuncia.radio_actual_m,
        antiguedad: this.config.antiguedadMaximaUbicacionH,
      })
      .getRawMany<Destinatario>();
  }

  /**
   * Procesa las emisiones pendientes.
   *
   * Toma los trabajos con `FOR UPDATE SKIP LOCKED`: si hubiera más de un proceso
   * trabajando, cada uno se lleva trabajos distintos en lugar de bloquearse o,
   * peor, enviar la misma alerta dos veces.
   */
  async procesarPendientes(limite = 10): Promise<number> {
    const pendientes = await this.dataSource.transaction(async (manager) => {
      const filas = await manager.query(
        `SELECT id FROM emisiones_alerta
          WHERE estado = 'pendiente' AND intentos < $1
          ORDER BY creada_en ASC
          LIMIT $2
          FOR UPDATE SKIP LOCKED`,
        [this.config.maxIntentosEmision, limite],
      );

      const ids = filas.map((f: { id: string }) => f.id);
      if (ids.length > 0) {
        await manager
          .getRepository(EmisionAlerta)
          .update(ids, { estado: 'procesando' });
      }
      return ids as string[];
    });

    let procesadas = 0;
    for (const id of pendientes) {
      if (await this.procesarUna(id)) procesadas++;
    }
    return procesadas;
  }

  private async procesarUna(emisionId: string): Promise<boolean> {
    try {
      const emision = await this.emisionesRepository.findOneOrFail({
        where: { id: emisionId },
      });

      const denuncia = await this.dataSource
        .getRepository(Denuncia)
        .findOneOrFail({ where: { id: emision.denuncia_id } });

      // Entre encolar y procesar pudo caducar o ser desactivada. Emitir una
      // alerta que ya no debe difundirse sería exactamente lo que el diseño
      // impide, así que se descarta el trabajo en lugar de ejecutarlo.
      // El aviso directo se envía aunque la denuncia esté REGISTRADA: la persona
      // reportada tiene derecho a enterarse antes de que nada se difunda, no
      // después. Solo se descarta si la denuncia ya dejó de estar activa.
      const esAvisoDirecto = emision.motivo === 'coincidencia_documento';
      const yaNoCorresponde = esAvisoDirecto
        ? denuncia.estado !== EstadoDenuncia.ACTIVA
        : denuncia.estado !== EstadoDenuncia.ACTIVA ||
          denuncia.nivel_confianza === NivelConfianza.REGISTRADA;

      if (yaNoCorresponde) {
        await this.emisionesRepository.update(emisionId, {
          estado: 'completada',
          destinatarios: 0,
          emitida_en: new Date(),
          ultimo_error: `descartada: la denuncia está ${denuncia.estado}/${denuncia.nivel_confianza}`,
        });
        return true;
      }

      // Un aviso directo va a una persona concreta; una difusión resuelve la
      // consulta geográfica. Es la única diferencia entre ambos recorridos.
      const destinatarios = emision.usuario_objetivo_id
        ? await this.dispositivosDe(emision.usuario_objetivo_id)
        : await this.destinatariosDe(denuncia);

      if (destinatarios.length > 0) {
        await this.enviarA(emisionId, denuncia, destinatarios, emision.motivo);
      }

      await this.emisionesRepository.update(emisionId, {
        estado: 'completada',
        destinatarios: destinatarios.length,
        emitida_en: new Date(),
      });

      this.logger.log(
        `Alerta emitida a ${destinatarios.length} destinatario(s) en ${emision.radio_m} m`,
      );
      return true;
    } catch (error) {
      const mensaje = (error as Error).message;
      this.logger.error(`Emisión ${emisionId} falló: ${mensaje}`);

      // Vuelve a pendiente para reintentar; al agotar los intentos queda fallida
      // y deja de tomarse, para no reintentar en bucle un trabajo imposible.
      await this.dataSource.query(
        `UPDATE emisiones_alerta
            SET intentos = intentos + 1,
                ultimo_error = $2,
                estado = CASE WHEN intentos + 1 >= $3 THEN 'fallida' ELSE 'pendiente' END
          WHERE id = $1`,
        [emisionId, mensaje, this.config.maxIntentosEmision],
      );
      return false;
    }
  }

  /**
   * Qué dice la notificación.
   *
   * El aviso a la persona reportada **no revela quién la denunció** (I8): solo
   * que la denuncia existe y que puede retirarla. Volcar la identidad del
   * denunciante aquí obligaría a entrar en modo confrontación a quien quizá solo
   * quiere que la alerta se detenga.
   *
   * Ninguno de los dos mensajes nombra a un tercero: la persona buscada es el
   * único sujeto identificable del sistema (I3).
   */
  private contenidoSegunMotivo(
    motivo: MotivoEmision,
    denuncia: Denuncia,
  ): { titulo: string; cuerpo: string } {
    if (motivo === 'coincidencia_documento') {
      return {
        titulo: 'Existe una denuncia que te identifica',
        cuerpo:
          'Alguien te reportó como persona desaparecida. Si estás bien, puedes retirar la alerta desde la app.',
      };
    }

    return {
      titulo: 'Persona desaparecida cerca de ti',
      cuerpo: denuncia.nombre_persona_buscada
        ? `Se busca a ${denuncia.nombre_persona_buscada}. Toca para ver los detalles.`
        : 'Hay una denuncia de desaparición en tu zona.',
    };
  }

  /** Envía y registra una entrega por destinatario, con su distancia. */
  private async enviarA(
    emisionId: string,
    denuncia: Denuncia,
    destinatarios: Destinatario[],
    motivo: MotivoEmision,
  ): Promise<void> {
    const entregas = this.dataSource.getRepository(EntregaAlerta);

    await entregas.insert(
      destinatarios.map((d) => ({
        emision_id: emisionId,
        usuario_id: d.usuario_id,
        dispositivo_id: d.dispositivo_id,
        distancia_m: d.distancia_m,
        estado: 'encolada' as const,
      })),
    );

    const mensajes: MensajePush[] = destinatarios.map((d) => ({
      push_token: d.push_token,
      ...this.contenidoSegunMotivo(motivo, denuncia),
      datos: { denuncia_id: denuncia.id, motivo },
    }));

    const resultados = await this.pasarela.enviar(mensajes);

    for (const resultado of resultados) {
      const destinatario = destinatarios.find(
        (d) => d.push_token === resultado.push_token,
      );
      if (!destinatario) continue;

      await entregas.update(
        { emision_id: emisionId, dispositivo_id: destinatario.dispositivo_id },
        {
          estado: resultado.aceptado ? 'aceptada' : 'fallida',
          resultado_pasarela: resultado.detalle,
        },
      );
    }
  }
}
