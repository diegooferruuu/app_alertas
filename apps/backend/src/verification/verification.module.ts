import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [UsersModule],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
