import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { PersonalDataDto } from './dto/documento.dto';

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

  constructor(private usersService: UsersService) {}

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
    const textoExtraido = await this.extraerTextoDelDocumento(idFrontBase64);
    this.logger.debug(`OCR extrajo ${textoExtraido.length} caracteres`);

    const comparacion = this.compararDatosExtraidos(textoExtraido, datosDeclarados);
    if (!comparacion.coincide) {
      throw new BadRequestException(
        `Los datos declarados no coinciden con los extraídos del documento: ${comparacion.motivo}`,
      );
    }

    // Chequeo temprano de duplicados para no hacer perder tiempo a la persona
    const ciHash = this.hashDeCi(datosDeclarados.ci_number);
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
    const textoExtraido = await this.extraerTextoDelDocumento(idFrontBase64);
    this.logger.debug(`OCR extrajo ${textoExtraido.length} caracteres`);

    const comparacion = this.compararDatosExtraidos(textoExtraido, datosDeclarados);
    if (!comparacion.coincide) {
      throw new BadRequestException(
        `Los datos declarados no coinciden con los extraídos del documento: ${comparacion.motivo}`,
      );
    }

    const ciHash = this.hashDeCi(datosDeclarados.ci_number);

    const usuarioExistente = await this.usersService.findByCiHash(ciHash);
    if (usuarioExistente && usuarioExistente.id !== userId) {
      throw new BadRequestException(
        'Este documento ya está registrado en otra cuenta',
      );
    }

    await this.usersService.registrarDocumento(userId, ciHash);

    return {
      documento_registrado: true,
      message: 'Documento registrado correctamente',
    };
  }

  /** El número de documento nunca se almacena en claro, solo su hash. */
  private hashDeCi(ciNumber: string): string {
    return createHash('sha256').update(ciNumber.trim()).digest('hex');
  }

  private async extraerTextoDelDocumento(imageBase64: string): Promise<string> {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa');
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const { data } = await worker.recognize(imageBuffer);
      await worker.terminate();
      return data.text;
    } catch (error) {
      throw new BadRequestException(
        `No se pudo leer el documento: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Compara los datos declarados contra el texto extraído por OCR.
   * Coincidencia no significa autenticidad: el documento pudo ser de otra
   * persona. Significa que lo declarado es consistente con lo que se leyó.
   */
  private compararDatosExtraidos(
    textoExtraido: string,
    datosDeclarados: PersonalDataDto,
  ): { coincide: boolean; motivo?: string } {
    const normalizar = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    const texto = normalizar(textoExtraido);

    const ciNormalizado = datosDeclarados.ci_number.replace(/\D/g, '');
    if (!texto.includes(ciNormalizado)) {
      return {
        coincide: false,
        motivo: `el número ${ciNormalizado} no aparece en el documento`,
      };
    }

    const partesDelNombre = normalizar(datosDeclarados.full_name)
      .split(' ')
      .filter((p) => p.length > 3);

    const nombreEncontrado = partesDelNombre.some((parte) => texto.includes(parte));
    if (!nombreEncontrado) {
      return { coincide: false, motivo: 'el nombre no aparece en el documento' };
    }

    return { coincide: true };
  }
}
