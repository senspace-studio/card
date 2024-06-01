import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NeynarModule } from './neynar/neynar.module';
import { PointsModule } from './points/points.module';
import { ViemModule } from './viem/viem.module';
import {
  DB_DOMAIN,
  DB_NAME,
  DB_PASSWORD,
  DB_PORT,
  DB_USERNAME,
} from 'src/utils/env';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { CronModule } from './cron/cron.module';
import { OgpModule } from './ogp/ogp.module';
import { ScorecardEntity } from 'src/entities/scorecard';
import { GashaModule } from './gasha/gasha.module';
import { WebhookModule } from './webhook/webhook.module';
import { WarEntity } from 'src/entities/war.entity';
import { WarModule } from './war/war.module';
import { EngineModule } from './engine/engine.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: DB_DOMAIN,
      port: DB_PORT,
      username: DB_USERNAME,
      password: DB_PASSWORD,
      database: DB_NAME,
      entities: [AccountEntity, TotalEntity, ScorecardEntity, WarEntity],
      synchronize: true,
    }),
    ScheduleModule.forRoot(),
    NeynarModule,
    ViemModule,
    PointsModule,
    CronModule,
    OgpModule,
    GashaModule,
    WebhookModule,
    WarModule,
    EngineModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
