import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationService } from './verification.service';
import { DocumentoBloqueado } from '../sanciones/entities/documento-bloqueado.entity';
import { UsersModule } from '../users/users.module';
import { AlertasModule } from '../alertas/alertas.module';
import { ComparadorDeRostros } from './rostros/comparador-de-rostros';
import { ComparadorFaceApi } from './rostros/comparador-face-api';
import { LectorDeDocumento } from './documento/lector-de-documento';
import { LectorTesseract } from './documento/lector-tesseract';

@Module({
  // AlertasModule: al registrar el documento se avisa a la persona de las
  // denuncias activas que ya la identifican (H4.4). El acoplamiento va en un
  // solo sentido —verificación depende de alertas, no al revés—, así que no
  // introduce ciclo.
  //
  // DocumentoBloqueado: para rechazar el re-registro de un documento bloqueado
  // por sanción (H4.5). Solo se lee aquí; la escritura vive en sanciones.
  imports: [
    TypeOrmModule.forFeature([DocumentoBloqueado]),
    UsersModule,
    AlertasModule,
  ],
  providers: [
    VerificationService,
    // El puerto se resuelve a la implementación real. Las pruebas sustituyen
    // este proveedor por el doble y así no cargan modelos ni ejecutan
    // inferencia; ver `ComparadorDeRostrosSimulado`.
    { provide: ComparadorDeRostros, useClass: ComparadorFaceApi },
    { provide: LectorDeDocumento, useClass: LectorTesseract },
  ],
  exports: [VerificationService],
})
export class VerificationModule {}
