import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { randomBytes } from 'crypto';
import * as bcryptjs from 'bcryptjs';
import { User } from './entities/user.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { NOMBRE_DE_CUENTA_ELIMINADA, correoDeCuentaEliminada } from './domain/cuenta-eliminada';
import { EstadoDenuncia } from '../denuncias/domain/estados';
import { DeclaracionJurada } from '../declaraciones/entities/declaracion-jurada.entity';
import { Dispositivo } from '../alertas/entities/dispositivo.entity';
import { revocarEmisionesPendientes } from '../alertas/revocacion';

/**
 * Eliminar una cuenta, y recuperarla con el mismo carnet.
 *
 * Google Play exige que quien crea una cuenta pueda eliminarla. Aquí eliminar
 * es **borrar los datos personales**, no la fila: de la cuenta cuelgan
 * declaraciones juradas, faltas y claves de firma que son de solo inserción, y
 * una denuncia firmada tiene que seguir siendo atribuible (I4, I7, I11). Google
 * admite conservar datos por prevención de fraude o por obligación legal si la
 * política de privacidad lo dice, y la dice.
 *
 * Lo que queda es el hash del documento con su historial. Por eso volver con el
 * mismo carnet no empieza de cero: recupera la misma cuenta, con sus faltas.
 * Si no fuera así, eliminar la cuenta sería la salida de una sanción.
 */
@Injectable()
export class CuentasService {
  private readonly logger = new Logger(CuentasService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Elimina la cuenta de quien la pide, que confirma con su contraseña.
   *
   * La contraseña se pide aunque haya sesión: es lo único irreversible que la
   * persona puede hacer desde la app, y un teléfono prestado o robado no debe
   * bastar para hacerlo.
   *
   * Lo que pasa, en una sola transacción:
   *  - sus alertas activas dejan de difundirse (pasan a CADUCADA), como con una
   *    suspensión; el aviso directo a la persona reportada sí sale, porque le
   *    sirve para retirar una denuncia que sigue existiendo;
   *  - se borran nombre, correo, teléfono, contraseña, ubicación y dispositivos;
   *  - el nombre del documento se conserva solo si firmó alguna declaración
   *    jurada: sin él, la constancia que pide la persona reportada no podría
   *    decir quién la firmó, y la declaración dejaría de probar nada.
   */
  async eliminar(userId: string, contrasena: string): Promise<{ mensaje: string }> {
    return this.eliminarCon(userId, async (cuenta) => {
      if (!(await bcryptjs.compare(contrasena, cuenta.password_hash))) {
        throw new ForbiddenException('La contraseña no es correcta');
      }
    });
  }

  /**
   * Elimina una cuenta a pedido, sin contraseña: la vía de quien ya no tiene la
   * app y lo pide por correo, como exige Google Play. La corre quien opera el
   * servidor (`deploy/eliminar-cuenta.sh`), después de comprobar que el pedido
   * llegó desde el correo de la cuenta. Hace exactamente lo mismo que desde la
   * app.
   */
  async eliminarPorPedido(userId: string): Promise<{ mensaje: string }> {
    return this.eliminarCon(userId, async () => undefined);
  }

  private async eliminarCon(
    userId: string,
    confirmar: (cuenta: User) => Promise<void>
  ): Promise<{ mensaje: string }> {
    // El hash nuevo se calcula fuera de la transacción: bcrypt tarda, y la fila
    // queda bloqueada mientras tanto.
    const contrasenaInutilizable = await this.contrasenaInutilizable();

    return this.dataSource.transaction(async (manager) => {
      const cuenta = await this.cuentaActiva(manager, userId);
      if (!cuenta) throw new UnauthorizedException('La sesión ya no es válida');
      await confirmar(cuenta);

      const [detenidas]: [Array<{ id: string }>, number] = await manager.query(
        `UPDATE denuncias SET estado = $2
          WHERE denunciante_id = $1 AND estado = $3
          RETURNING id`,
        [userId, EstadoDenuncia.CADUCADA, EstadoDenuncia.ACTIVA]
      );
      for (const { id } of detenidas) {
        await revocarEmisionesPendientes(manager, id, 'quien denunció eliminó su cuenta', {
          soloDifusion: true,
        });
      }

      const firmoDeclaraciones = await manager
        .getRepository(DeclaracionJurada)
        .exists({ where: { usuario_id: userId } });

      await this.borrarDatosPersonales(manager, cuenta, contrasenaInutilizable, {
        conservarNombreDelDocumento: firmoDeclaraciones,
      });

      this.logger.log(
        `Cuenta eliminada; alertas detenidas: ${detenidas.length}; ` +
          `nombre del documento ${firmoDeclaraciones ? 'conservado por sus declaraciones' : 'borrado'}`
      );
      return { mensaje: 'Tu cuenta se eliminó.' };
    });
  }

  /**
   * Devuelve a la vida una cuenta eliminada, con los datos de la cuenta nueva
   * que acaba de registrar el mismo carnet.
   *
   * La cuenta nueva se creó antes de saber de quién era el documento: el
   * registro pide correo y contraseña primero, y el carnet después. Recién al
   * registrar el documento se descubre que ese carnet ya tenía historia. Se
   * conserva la cuenta vieja —su identificador es al que apuntan sus faltas y
   * sus declaraciones, que no se pueden mover— y recibe el nombre, el correo,
   * la contraseña y los dispositivos de la nueva, que queda eliminada. La sesión
   * de la nueva deja de valer: la persona vuelve a entrar con su correo de
   * siempre, que ahora es el de la cuenta recuperada.
   *
   * Solo la recupera quien registra el documento con todas las comprobaciones
   * de un registro normal —el número y el nombre leídos del carnet, el rostro—,
   * que son las mismas con que se creó la primera vez.
   */
  async recuperar(eliminadaId: string, nuevaId: string): Promise<User> {
    const contrasenaInutilizable = await this.contrasenaInutilizable();

    return this.dataSource.transaction(async (manager) => {
      const usuarios = manager.getRepository(User);
      const nueva = await this.cuentaActiva(manager, nuevaId);
      const eliminada = await usuarios
        .createQueryBuilder('u')
        .where('u.id = :id', { id: eliminadaId })
        .andWhere('u.deleted_at IS NOT NULL')
        .setLock('pessimistic_write')
        .getOne();

      if (!nueva) throw new UnauthorizedException('La sesión ya no es válida');
      // Una cuenta que ya registró su propio documento es otra identidad:
      // juntarla con la eliminada mezclaría dos personas.
      if (!eliminada || nueva.documento_registrado) {
        throw new BadRequestException('Este documento ya está registrado en otra cuenta');
      }

      // Primero se libera el correo de la nueva: es único, y la recuperada lo
      // va a usar.
      await this.borrarDatosPersonales(manager, nueva, contrasenaInutilizable, {
        conservarNombreDelDocumento: false,
      });

      await usuarios.update(eliminada.id, {
        full_name: nueva.full_name,
        primer_nombre: nueva.primer_nombre,
        segundo_nombre: nueva.segundo_nombre,
        primer_apellido: nueva.primer_apellido,
        segundo_apellido: nueva.segundo_apellido,
        email: nueva.email,
        phone: nueva.phone,
        password_hash: nueva.password_hash,
        // El nombre de la cuenta nueva es el que acaba de contrastarse con el
        // carnet: pasa a ser la referencia de la firma, como en un registro.
        nombre_documento: nueva.full_name,
        documento_registrado_en: new Date(),
        deleted_at: null,
      });
      // Los dispositivos ya se borraron con los datos de la nueva; el teléfono
      // los vuelve a registrar al iniciar sesión.

      this.logger.log('Cuenta eliminada recuperada al registrar el mismo documento');
      return usuarios.findOneByOrFail({ id: eliminada.id });
    });
  }

  private cuentaActiva(manager: EntityManager, id: string): Promise<User | null> {
    return manager
      .getRepository(User)
      .createQueryBuilder('u')
      .where('u.id = :id', { id })
      .andWhere('u.deleted_at IS NULL')
      .setLock('pessimistic_write')
      .getOne();
  }

  /**
   * Un hash de bcrypt válido de una contraseña que nadie conoce.
   *
   * La columna no admite nulos, y un valor que no fuera un hash haría fallar la
   * comparación del inicio de sesión con un error en vez de con un «no».
   */
  private contrasenaInutilizable(): Promise<string> {
    return bcryptjs.hash(randomBytes(32).toString('hex'), 10);
  }

  private async borrarDatosPersonales(
    manager: EntityManager,
    cuenta: User,
    contrasenaInutilizable: string,
    { conservarNombreDelDocumento }: { conservarNombreDelDocumento: boolean }
  ): Promise<void> {
    await manager.getRepository(User).update(cuenta.id, {
      full_name: NOMBRE_DE_CUENTA_ELIMINADA,
      primer_nombre: null,
      segundo_nombre: null,
      primer_apellido: null,
      segundo_apellido: null,
      email: correoDeCuentaEliminada(cuenta.id),
      phone: null,
      password_hash: contrasenaInutilizable,
      nombre_documento: conservarNombreDelDocumento ? cuenta.nombre_documento : null,
      push_token: null,
      push_token_updated_at: null,
      last_location: null,
      last_location_at: null,
      deleted_at: new Date(),
    });
    // Los tokens de notificación identifican el teléfono: son datos personales.
    // Las entregas ya hechas se quedan, sin llave hacia aquí, para las métricas.
    await manager.getRepository(Dispositivo).delete({ usuario_id: cuenta.id });
    await manager.getRepository(RefreshToken).delete({ user_id: cuenta.id });
  }
}
