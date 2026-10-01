import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { AlertasService } from '../alertas/alertas.service';
import { DocumentoBloqueado } from '../sanciones/entities/documento-bloqueado.entity';
import { PersonalDataDto } from './dto/documento.dto';
import { nombreConsistenteConDocumento } from './domain/nombres';
import { MENSAJES, esConsistente } from './domain/comparacion-facial';
import { ComparadorDeRostros } from './rostros/comparador-de-rostros';
import { LectorDeDocumento } from './documento/lector-de-documento';

/**
 * Registro de documentos de identidad.
 *
 * El OCR **extrae datos**; no autentica. Este servicio no establece que una
 * persona sea quien dice ser: deja constancia de que registró un documento
 * cuyos datos extraídos coinciden con los que declaró. La terminología importa
 * porque de ella depende lo que el sistema puede afirmar después.
 */
@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(
    private usersService: UsersService,
    private alertasService: AlertasService,
    @InjectRepository(DocumentoBloqueado)
    private documentosBloqueados: Repository<DocumentoBloqueado>,
    private comparador: ComparadorDeRostros,
    private lector: LectorDeDocumento,
  ) {}

  /**
   * Un documento bloqueado no puede registrarse (§3.4, sanción 5.4).
   *
   * Corta el intento de esquivar una suspensión con otra cuenta. Se comprueba
   * antes que el duplicado —da un motivo claro— y por hash, nunca por número.
   */
  private async rechazarSiBloqueado(ciHash: string): Promise<void> {
    const bloqueado = await this.documentosBloqueados.countBy({
      ci_hash: ciHash,
    });
    if (bloqueado > 0) {
      throw new BadRequestException(
        'Este documento está bloqueado y no puede registrarse',
      );
    }
  }

  /**
   * Paso intermedio: comprueba que las imágenes del documento sean legibles y
   * que los datos declarados coincidan con los datos extraídos. No deja
   * constancia todavía; eso ocurre tras la selfie.
   */
  async extraerDatosDocumento(
    userId: string,
    idFrontBase64: string,
    idBackBase64: string,
    datosDeclarados: PersonalDataDto,
  ): Promise<{ coincide: boolean; message: string }> {
    const nombreDeLaCuenta = (await this.usersService.findById(userId)).full_name;
    const textoExtraido = await this.lector.leer(
      Buffer.from(idFrontBase64, 'base64'),
    );

    const comparacion = this.compararDatosExtraidos(
      textoExtraido,
      nombreDeLaCuenta,
      datosDeclarados,
    );
    if (!comparacion.coincide) {
      throw new BadRequestException(
        `Los datos declarados no coinciden con los extraídos del documento: ${comparacion.motivo}`,
      );
    }

    // Chequeo temprano de duplicados para no hacer perder tiempo a la persona
    const ciHash = this.hashDeCi(datosDeclarados.ci_number);
    await this.rechazarSiBloqueado(ciHash);
    const usuarioExistente = await this.usersService.findByCiHash(ciHash);
    if (usuarioExistente && usuarioExistente.id !== userId) {
      throw new BadRequestException(
        'Este documento ya está registrado en otra cuenta',
      );
    }

    return {
      coincide: true,
      message: 'Los datos declarados coinciden con los extraídos del documento',
    };
  }

  /**
   * Deja constancia del documento en la cuenta. A partir de aquí la persona
   * puede denunciar, porque sus denuncias quedan atribuidas a este documento.
   */
  async registrarDocumento(
    userId: string,
    idFrontBase64: string,
    idBackBase64: string,
    selfieBase64: string,
    datosDeclarados: PersonalDataDto,
  ): Promise<any> {
    const nombreDeLaCuenta = (await this.usersService.findById(userId)).full_name;
    const textoExtraido = await this.lector.leer(
      Buffer.from(idFrontBase64, 'base64'),
    );

    const comparacion = this.compararDatosExtraidos(
      textoExtraido,
      nombreDeLaCuenta,
      datosDeclarados,
    );
    if (!comparacion.coincide) {
      throw new BadRequestException(
        `Los datos declarados no coinciden con los extraídos del documento: ${comparacion.motivo}`,
      );
    }

    await this.exigirRostroConsistente(idFrontBase64, selfieBase64);

    const ciHash = this.hashDeCi(datosDeclarados.ci_number);

    await this.rechazarSiBloqueado(ciHash);
    const usuarioExistente = await this.usersService.findByCiHash(ciHash);
    if (usuarioExistente && usuarioExistente.id !== userId) {
      throw new BadRequestException(
        'Este documento ya está registrado en otra cuenta',
      );
    }

    // El nombre de la cuenta queda registrado como referencia de la firma
    // escrita a mano que exige la declaración jurada.
    await this.usersService.registrarDocumento(userId, ciHash);

    // H4.4 — Vía de acceso para la persona reportada sin cuenta previa.
    //
    // Una denuncia pudo presentarse contra este documento antes de que la
    // persona existiera en el sistema. Ahora que su `ci_hash` se conoce, se le
    // avisa de las denuncias activas que la identifican. El registro del
    // documento ya quedó guardado y la lista de denuncias que puede cerrar
    // (`GET /cierres/denuncias`) la muestra igual, así que si este aviso
    // fallara, el acceso no se pierde: se propaga el error y el reintento es
    // seguro (idempotente), sin dejar el documento a medio registrar.
    const denunciasQueLoIdentifican =
      await this.alertasService.avisarPersonaReportada(userId, ciHash);

    return {
      documento_registrado: true,
      message: 'Documento registrado correctamente',
      // Deja que la app lo lleve de inmediato al interruptor —«minutos, no
      // horas»— sin esperar a que llegue la notificación push. No revela nada
      // del denunciante (I8): es un recuento de denuncias sobre uno mismo.
      denuncias_que_te_identifican: denunciasQueLoIdentifican,
    };
  }

  /**
   * Comprueba que el rostro de la selfie sea consistente con el del documento.
   *
   * Esto **no autentica**. Establece algo más estrecho: que quien se tomó la
   * selfie se parece a quien aparece impreso en el documento que fotografió.
   * Sigue sin haber nadie que confirme que ese documento es auténtico, y no hay
   * detección de vivacidad, así que una fotografía impresa sostenida frente a la
   * cámara pasa igual. Lo que sí hace es cerrar el camino más barato para
   * suplantar a alguien: antes bastaba con conseguir una foto de su carnet.
   *
   * La selfie no se guarda, ni se guarda el descriptor que se calcula de ella:
   * un descriptor facial identifica a una persona igual que su fotografía. Se
   * comparan y se descartan sin salir de esta llamada.
   *
   * Corre después de la comprobación del nombre porque es la parte cara —carga
   * modelos y ejecuta inferencia— y no tiene sentido pagarla cuando los datos
   * declarados ya no cuadran con el documento.
   */
  private async exigirRostroConsistente(
    idFrontBase64: string,
    selfieBase64: string,
  ): Promise<void> {
    const resultado = await this.comparador.comparar(
      Buffer.from(idFrontBase64, 'base64'),
      Buffer.from(selfieBase64, 'base64'),
    );

    if (resultado.estado !== 'comparado') {
      throw new BadRequestException(MENSAJES[resultado.estado]);
    }

    // La decisión se toma aquí, en el núcleo, sobre la medición que devolvió el
    // comparador. Es lo que mantiene el umbral en un solo sitio y versionado con
    // el dominio, en vez de viajar con el adaptador.
    if (!esConsistente(resultado.distancia)) {
      // No se dice la distancia: es una medida de cuán parecidos son dos
      // rostros, y devolverla dejaría afinar una suplantación a base de
      // reintentos hasta ver el número bajar.
      this.logger.warn(
        `Registro de documento rechazado: rostros no consistentes (distancia ${resultado.distancia.toFixed(4)})`,
      );
      throw new BadRequestException(MENSAJES.no_coincide);
    }
  }

  /** El número de documento nunca se almacena en claro, solo su hash. */
  private hashDeCi(ciNumber: string): string {
    return createHash('sha256').update(ciNumber.trim()).digest('hex');
  }

  /**
   * Compara los datos declarados contra el texto extraído por OCR.
   *
   * Coincidencia no significa autenticidad: el documento pudo ser de otra
   * persona. Significa que lo declarado es consistente con lo que se leyó.
   */
  private compararDatosExtraidos(
    textoExtraido: string,
    nombreDeLaCuenta: string,
    datosDeclarados: PersonalDataDto,
  ): { coincide: boolean; motivo?: string } {
    const ciNormalizado = datosDeclarados.ci_number.replace(/\D/g, '');
    if (!textoExtraido.replace(/\D/g, '').includes(ciNormalizado)) {
      return {
        coincide: false,
        motivo: `el número ${ciNormalizado} no aparece en el documento`,
      };
    }

    return nombreConsistenteConDocumento(nombreDeLaCuenta, textoExtraido);
  }
}
