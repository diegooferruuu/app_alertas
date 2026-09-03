import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationService } from './verification.service';
import { DocumentoBloqueado } from '../desactivaciones/entities/documento-bloqueado.entity';
import { UsersModule } from '../users/users.module';
import { AlertasModule } from '../alertas/alertas.module';

@Module({
  // AlertasModule: al registrar el documento se avisa a la persona de las
  // denuncias activas que ya la identifican (H4.4). El acoplamiento va en un
  // solo sentido —verificación depende de alertas, no al revés—, así que no
  // introduce ciclo.
  //
  // DocumentoBloqueado: para rechazar el re-registro de un documento bloqueado
  // por sanción (H4.5). Solo se lee aquí; la escritura vive en desactivaciones.
  imports: [
    TypeOrmModule.forFeature([DocumentoBloqueado]),
    UsersModule,
    AlertasModule,
  ],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
