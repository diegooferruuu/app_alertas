import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Cierre, TipoCierre } from './entities/cierre.entity';
import { CerrarDenunciaDto } from './dto/cerrar-denuncia.dto';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import {
  EstadoDenuncia,
  NivelConfianza,
  puedeTransicionarEstado,
} from '../denuncias/domain/estados';
import { revocarEmisionesPendientes } from '../alertas/revocacion';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { SancionesService } from '../sanciones/sanciones.service';

/** Una denuncia que identifica a quien consulta, tal como puede vérsela. */
export interface DenunciaQueMeIdentifica {
  id: string;
  nombre_persona_buscada: string | null;
  description: string;
  nivel_confianza: NivelConfianza;
  estado: EstadoDenuncia;
  se_esta_difundiendo: boolean;
  /** Si todavía admite el cierre. Falso en las ya cerradas. */
  puede_cerrarse: boolean;
  created_at: Date;
}

/** Lo que ve quien acaba de cerrar una alerta sobre sí mismo. */
export interface ResultadoCierre {
  cerrada: true;
  denuncia_id: string;
  tipo: TipoCierre;
  mensaje: string;
  /**
   * Falso si nadie llegó a firmarla: la constancia se arma con la declaración
   * jurada, y una denuncia REGISTRADA todavía no la tiene.
   */
  constancia_disponible: boolean;
}

const CONSTANCIA =
  'Existe una constancia de esta denuncia, con la identidad de quien la firmó, disponible a tu solicitud.';
const SIN_FIRMA = 'Nadie llegó a firmarla, así que no hay constancia que pedir.';

@Injectable()
export class CierresService {
  private readonly logger = new Logger(CierresService.name);

  constructor(
    private dataSource: DataSource,
    private usersService: UsersService,
    private sancionesService: SancionesService,
  ) {}

  /**
   * Denuncias que identifican a la persona autenticada.
   *
   * Es lo que hace accionable el aviso: quien recibe la notificación necesita
   * poder llegar a la denuncia concreta para cerrarla. No se devuelve nada del
   * denunciante (invariante I8): solo lo que se declaró sobre la persona.
   *
   * Incluye las CADUCADAS a propósito: no se difunden, pero pueden revivir con
   * el caso de la FELCC, y ocultarlas dejaría a la persona sin forma de apagar
   * algo que puede volver a encenderse. Incluye las INVALIDADAS, ya cerradas,
   * porque la constancia está disponible de forma indefinida (§6.1) y esta
   * lista es el único sitio desde donde la persona llega a ella. Y las CERRADAS
   * por su autor, que todavía admiten la respuesta de la persona (ver `cerrar`).
   */
  async denunciasQueMeIdentifican(userId: string): Promise<DenunciaQueMeIdentifica[]> {
    const usuario = await this.usersService.findById(userId);
    if (!usuario.ci_hash) return [];

    const denuncias = await this.dataSource.getRepository(Denuncia).find({
      where: {
        ci_hash_persona_buscada: usuario.ci_hash,
        estado: In([
          EstadoDenuncia.ACTIVA,
          EstadoDenuncia.CADUCADA,
          EstadoDenuncia.INVALIDADA,
          EstadoDenuncia.CERRADA,
        ]),
      },
      order: { created_at: 'DESC' },
    });
    if (denuncias.length === 0) return [];

    // Una denuncia admite un solo cierre: las que ya lo tienen no se ofrecen.
    const respondidas = new Set(
      (
        await this.dataSource.getRepository(Cierre).find({
          where: { denuncia_id: In(denuncias.map((d) => d.id)) },
          select: { denuncia_id: true },
        })
      ).map((c) => c.denuncia_id),
    );

    return denuncias.map((d) => ({
      id: d.id,
      nombre_persona_buscada: d.nombre_persona_buscada,
      description: d.description,
      nivel_confianza: d.nivel_confianza,
      estado: d.estado,
      se_esta_difundiendo:
        d.estado === EstadoDenuncia.ACTIVA && d.nivel_confianza !== NivelConfianza.REGISTRADA,
      puede_cerrarse: d.estado !== EstadoDenuncia.INVALIDADA && !respondidas.has(d.id),
      created_at: d.created_at,
      // Deliberadamente ausente: quién la presentó. Esa identidad solo se
      // entrega por la vía deliberada de la constancia.
    }));
  }

  /**
   * Cierra una alerta que identifica a quien la ejecuta.
   *
   * **La única autorización posible** es que el documento registrado de la
   * persona autenticada coincida con el de la persona buscada. No hay rol ni
   * excepción administrativa que abra esta puerta: si existiera, existiría
   * también la forma de que otro la abriera en su nombre.
   *
   * Todo ocurre en una transacción. Un cierre a medias —la denuncia invalidada
   * pero la alerta todavía saliendo— dejaría a la persona expuesta justo cuando
   * pidió dejar de estarlo.
   */
  async cerrar(
    userId: string,
    denunciaId: string,
    dto: CerrarDenunciaDto,
  ): Promise<ResultadoCierre> {
    // «Es falsa» siempre bloquea. Con «Estoy bien» lo decide la persona, y la
    // app pregunta sin opción marcada: si no llega la respuesta, no se supone.
    const bloquea =
      dto.tipo === TipoCierre.CON_SANCION ? true : dto.bloquear_nueva_denuncia;
    if (bloquea === undefined) {
      throw new BadRequestException(
        'Indica si quien te denunció podrá volver a hacerlo si algún día desapareces',
      );
    }

    const usuario = await this.usersService.findById(userId);
    if (!usuario.documento_registrado || !usuario.ci_hash) {
      throw new ForbiddenException(
        'Registra tu documento de identidad para cerrar una alerta que te identifica',
      );
    }

    const { firmada, terminadaPorSuAutor } = await this.dataSource.transaction(async (manager) => {
      const denuncias = manager.getRepository(Denuncia);

      const denuncia = await denuncias
        .createQueryBuilder('d')
        // El hash de la persona buscada es `select: false`: hay que pedirlo.
        .addSelect('d.ci_hash_persona_buscada')
        .where('d.id = :id', { id: denunciaId })
        // Bloquea la fila hasta el commit: dos cierres simultáneos no pueden
        // superar ambos la comprobación de estado.
        .setLock('pessimistic_write')
        .getOne();

      if (!denuncia) throw new NotFoundException('Denuncia no encontrada');

      // Comparación de hashes, no de identidades.
      if (denuncia.ci_hash_persona_buscada !== usuario.ci_hash) {
        // El mismo error que si no existiera: distinguirlos convertiría esta ruta
        // en una forma de comprobar si un documento cualquiera está denunciado.
        throw new NotFoundException('Denuncia no encontrada');
      }

      if (denuncia.estado === EstadoDenuncia.INVALIDADA) {
        throw new ConflictException('Esta alerta ya fue cerrada');
      }

      // Una que su autor dio por terminada («La encontramos») ya no se difunde,
      // pero sigue admitiendo la respuesta de la persona. Si no, darla por
      // terminada sería la forma de escapar de la falta antes de que la persona
      // la declare falsa. Su estado no cambia —CERRADA es terminal—: el cierre
      // se registra igual, y una denuncia admite uno solo.
      const terminadaPorSuAutor = denuncia.estado === EstadoDenuncia.CERRADA;
      if (terminadaPorSuAutor) {
        if (await manager.getRepository(Cierre).exists({ where: { denuncia_id: denunciaId } })) {
          throw new ConflictException('Ya respondiste a esta denuncia');
        }
      } else if (!puedeTransicionarEstado(denuncia.estado, EstadoDenuncia.INVALIDADA)) {
        throw new ConflictException(`Una denuncia ${denuncia.estado} ya no puede cerrarse`);
      }

      // 1. INVALIDADA es el mismo estado para los dos tipos de cierre: el tipo
      //    solo queda en `cierres`. Es terminal —ni la caducidad ni el caso de la
      //    FELCC la reviven— y no se borra nada: la declaración que la respalda
      //    es de solo inserción y debe seguir siendo verificable.
      if (!terminadaPorSuAutor) {
        await denuncias.update(denunciaId, { estado: EstadoDenuncia.INVALIDADA });
      }

      // 2. Se revoca lo que todavía no salió.
      await revocarEmisionesPendientes(manager, denunciaId, 'la persona reportada cerró la alerta');

      // 3. El registro del cierre: auditoría, y la base de la suspensión y del
      //    bloqueo de volver a denunciar a esta persona.
      const denunciante = await manager.getRepository(User).findOneOrFail({
        where: { id: denuncia.denunciante_id },
        select: { id: true, ci_hash: true },
      });
      // El denunciante registró su documento para poder denunciar; la
      // restricción de la base garantiza el hash.
      const ciHashDenunciante = denunciante.ci_hash!;

      await manager.getRepository(Cierre).insert({
        denuncia_id: denunciaId,
        ci_hash_denunciante: ciHashDenunciante,
        ci_hash_persona_buscada: denuncia.ci_hash_persona_buscada,
        tipo_cierre: dto.tipo,
        bloquea_nueva_denuncia: bloquea,
      });

      // 4. Solo «Es falsa» sanciona: una falta para quien denunció y, si es la
      //    segunda persona distinta que lo declara, la suspensión.
      if (dto.tipo === TipoCierre.CON_SANCION) {
        await this.sancionesService.aplicarCierreConSancion(manager, {
          denuncianteId: denuncia.denunciante_id,
          ciHashDenunciante,
          denunciaId,
        });
      }

      return {
        firmada: denuncia.nivel_confianza !== NivelConfianza.REGISTRADA,
        terminadaPorSuAutor,
      };
    });

    // Sin identificadores de personas: este registro lo lee un operador.
    this.logger.log(`Alerta cerrada por la persona reportada (${dto.tipo}): ${denunciaId}`);

    const consecuencia =
      dto.tipo === TipoCierre.CON_SANCION
        ? 'Quien la presentó recibió una falta y no podrá volver a denunciarte.'
        : 'Quien la presentó no recibe ninguna sanción.';
    const constancia = firmada ? CONSTANCIA : SIN_FIRMA;
    return {
      cerrada: true,
      denuncia_id: denunciaId,
      tipo: dto.tipo,
      // Ninguno nombra a quien denunció (I8): su identidad está en la
      // declaración jurada y se entrega por la vía deliberada de la constancia.
      // «Ya no se difundirá» y no «dejó de difundirse»: una caducada no se estaba
      // difundiendo, y una sin firmar nunca llegó a hacerlo.
      mensaje: terminadaPorSuAutor
        ? `Quien la presentó ya había dado el caso por terminado, así que no se difundía. Tu respuesta quedó registrada. ${consecuencia} ${constancia}`
        : firmada
          ? `La alerta fue retirada y ya no se difundirá. ${consecuencia} ${constancia}`
          : `La denuncia quedó cerrada antes de difundirse. ${consecuencia} ${constancia}`,
      constancia_disponible: firmada,
    };
  }
}
