import { Module } from '@nestjs/common';
import { VerificationService } from './verification.service';
import { UsersModule } from '../users/users.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  // AlertasModule: al registrar el documento se avisa a la persona de las
  // denuncias activas que ya la identifican (H4.4). El acoplamiento va en un
  // solo sentido —verificación depende de alertas, no al revés—, así que no
  // introduce ciclo.
  imports: [UsersModule, AlertasModule],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
