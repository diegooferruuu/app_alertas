import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConstanciasService } from './constancias.service';
import { ConstanciasController } from './constancias.controller';
import { SolicitudConstancia } from './entities/solicitud-constancia.entity';
import { Denuncia } from '../denuncias/entities/denuncia.entity';
import { DeclaracionJurada } from '../declaraciones/entities/declaracion-jurada.entity';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SolicitudConstancia,
      Denuncia,
      DeclaracionJurada,
      User,
    ]),
    UsersModule,
  ],
  controllers: [ConstanciasController],
  providers: [ConstanciasService],
  exports: [ConstanciasService],
})
export class ConstanciasModule {}
