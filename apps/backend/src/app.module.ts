import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { DenunciasModule } from './denuncias/denuncias.module';
import { User } from './users/entities/user.entity';
import { RefreshToken } from './users/entities/refresh-token.entity';
import { ReputationEvent } from './users/entities/reputation-event.entity';
import { Denuncia } from './denuncias/entities/denuncia.entity';
import { baseDataSourceOptions } from './database/data-source';
import { denunciasConfig } from './config/denuncias.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '../../.env',
      load: [denunciasConfig],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST'),
        port: configService.get<number>('DB_PORT'),
        username: configService.get<string>('DB_USERNAME'),
        password: configService.get<string>('DB_PASSWORD'),
        database: configService.get<string>('DB_NAME'),
        entities: [User, RefreshToken, ReputationEvent, Denuncia],
        migrations: baseDataSourceOptions.migrations,
        migrationsTableName: baseDataSourceOptions.migrationsTableName,
        // El esquema se cambia solo por migraciones versionadas. Nunca activar
        // synchronize: altera la base sin dejar rastro ni forma de revertir.
        synchronize: false,
        migrationsRun: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    AuthModule,
    UsersModule,
    VerificationModule,
    DenunciasModule,
  ],
})
export class AppModule {}
