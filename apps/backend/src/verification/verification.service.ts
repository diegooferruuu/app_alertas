import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { PersonalDataDto } from './dto/verify-identity.dto';

@Injectable()
export class VerificationService {
  private readonly logger = new Logger(VerificationService.name);

  constructor(private usersService: UsersService) {}

  /**
   * Step intermedio: valida que las imágenes del carnet tengan buena calidad
   * y que los datos ingresados coincidan con el OCR. No marca al usuario como
   * verificado todavía (eso ocurre tras la selfie).
   */
  async verifyIdCard(
    userId: string,
    idFrontBase64: string,
    idBackBase64: string,
    personalData: PersonalDataDto,
  ): Promise<{ valid: boolean; message: string }> {
    const extractedText = await this.extractTextFromId(idFrontBase64);
    this.logger.debug(`OCR extracted ${extractedText.length} characters`);

    const dataMatch = this.validatePersonalData(extractedText, personalData);
    if (!dataMatch.valid) {
      throw new BadRequestException(
        `Los datos no coinciden con el carnet: ${dataMatch.reason}`,
      );
    }

    // Chequeo temprano de duplicados para no hacer perder tiempo al usuario
    const ciHash = createHash('sha256')
      .update(personalData.ci_number.trim())
      .digest('hex');
    const existingUser = await this.usersService.findByCiHash(ciHash);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException(
        'Este carnet ya está registrado en otra cuenta',
      );
    }

    return {
      valid: true,
      message: 'Datos del carnet verificados correctamente',
    };
  }

  async verifyIdentity(
    userId: string,
    idFrontBase64: string,
    idBackBase64: string,
    selfieBase64: string,
    personalData: PersonalDataDto,
  ): Promise<any> {
    // Step 1: OCR on ID front image
    const extractedText = await this.extractTextFromId(idFrontBase64);
    this.logger.debug(`OCR extracted ${extractedText.length} characters`);

    // Step 2: Validate personal data matches OCR
    const dataMatch = this.validatePersonalData(extractedText, personalData);
    if (!dataMatch.valid) {
      throw new BadRequestException(
        `Los datos no coinciden con el carnet: ${dataMatch.reason}`,
      );
    }

    // Step 3: Hash CI and check for duplicates
    const ciHash = createHash('sha256')
      .update(personalData.ci_number.trim())
      .digest('hex');

    const existingUser = await this.usersService.findByCiHash(ciHash);
    if (existingUser && existingUser.id !== userId) {
      throw new BadRequestException(
        'Este carnet ya está registrado en otra cuenta',
      );
    }

    // Step 4: Mark user as verified
    await this.usersService.setIdentityVerified(userId, ciHash);

    return {
      verified: true,
      message: 'Identidad verificada correctamente',
    };
  }

  private async extractTextFromId(imageBase64: string): Promise<string> {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('spa');
      const imageBuffer = Buffer.from(imageBase64, 'base64');
      const { data } = await worker.recognize(imageBuffer);
      await worker.terminate();
      return data.text;
    } catch (error) {
      throw new BadRequestException(
        `OCR fallido: ${(error as Error).message}`,
      );
    }
  }

  private validatePersonalData(
    ocrText: string,
    personalData: PersonalDataDto,
  ): { valid: boolean; reason?: string } {
    const normalize = (s: string) =>
      s
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .trim();

    const text = normalize(ocrText);

    // Validate CI number
    const ciNormalized = personalData.ci_number.replace(/\D/g, '');
    if (!text.includes(ciNormalized)) {
      return {
        valid: false,
        reason: `CI ${ciNormalized} no encontrado en el carnet`,
      };
    }

    // Validate at least one name part (>3 chars) appears in OCR
    const nameParts = normalize(personalData.full_name)
      .split(' ')
      .filter((p) => p.length > 3);

    const nameFound = nameParts.some((part) => text.includes(part));
    if (!nameFound) {
      return { valid: false, reason: 'Nombre no encontrado en el carnet' };
    }

    return { valid: true };
  }
}
