import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { createHash } from 'crypto';
import { UsersService } from '../users/users.service';

@Injectable()
export class VerificationService {
  private visionClient?: ImageAnnotatorClient;

  constructor(
    private configService: ConfigService,
    private usersService: UsersService,
  ) {
    // Initialize Google Cloud Vision client
    const credentialsPath = this.configService.get<string>(
      'GOOGLE_CLOUD_VISION_CREDENTIALS',
    );
    if (credentialsPath) {
      this.visionClient = new ImageAnnotatorClient({
        keyFilename: credentialsPath,
      });
    }
  }

  async verifyIdentity(userId: string, idCardBase64: string): Promise<any> {
    if (!this.visionClient) {
      throw new BadRequestException(
        'Vision API credentials not configured',
      );
    }

    try {
      // Convert base64 to buffer
      const imageBuffer = Buffer.from(idCardBase64, 'base64');

      // Call Google Cloud Vision API for OCR
      const [result] = await this.visionClient.textDetection({
        image: { content: imageBuffer },
      });

      const texts = result.textAnnotations;
      if (!texts || texts.length === 0) {
        throw new BadRequestException('No text found in ID card image');
      }

      // Extract CI number and name from OCR results
      const fullText = texts[0].description || '';
      const ciMatch = fullText.match(/\d{7,8}/); // Adjust pattern based on CI format

      if (!ciMatch) {
        throw new BadRequestException('Could not extract CI number from ID card');
      }

      const ciNumber = ciMatch[0];
      const ciHash = createHash('sha256').update(ciNumber).digest('hex');

      // Check if CI is already registered
      const existingUser = await this.usersService.findByCiHash(ciHash);
      if (existingUser && existingUser.id !== userId) {
        throw new BadRequestException('This ID card is already registered');
      }

      // Update user with verified identity
      await this.usersService.setIdentityVerified(userId, ciHash);

      return {
        verified: true,
        ciHash,
        message: 'Identity verified successfully',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new BadRequestException(`Verification failed: ${errorMessage}`);
    }
  }
}
