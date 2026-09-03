import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { VerificationModule } from './verification/verification.module';
import { DenunciasModule } from './denuncias/denuncias.module';
import { DeclaracionesModule } from './declaraciones/declaraciones.module';
import { AlertasModule } from './alertas/alertas.module';
import { DesactivacionesModule } from './desactivaciones/desactivaciones.module';
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
        // Se reutiliza el glob del DataSource en vez de listar las entidades a
        // mano. Con una lista manual, olvidar una entidad nueva rompe el
        // arranque —y las pruebas no lo detectan, porque su DataSource sí usa
        // el glob y las encuentra todas.
        entities: baseDataSourceOptions.entities,
        migrations: baseDataSourceOptions.migrations,
        migrationsTableName: baseDataSourceOptions.migrationsTableName,
        // El esquema se cambia solo por migraciones versionadas. Nunca activar
        // synchronize: altera la base sin dejar rastro ni forma de revertir.
        synchronize: false,
        migrationsRun: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),
    // Habilita el procesamiento en segundo plano: hoy la caducidad de alertas,
    // que ocurre sola sin que ningún usuario la dispare.
    ScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    VerificationModule,
    DenunciasModule,
    DeclaracionesModule,
    AlertasModule,
    DesactivacionesModule,
  ],
})
export class AppModule {}
