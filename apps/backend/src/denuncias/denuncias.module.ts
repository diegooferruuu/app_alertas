import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DenunciasService } from './denuncias.service';
import { DenunciasController } from './denuncias.controller';
import { Denuncia } from './entities/denuncia.entity';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Denuncia]), UsersModule],
  controllers: [DenunciasController],
  providers: [DenunciasService],
  exports: [DenunciasService],
})
export class DenunciasModule {}
