import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { NeynarModule } from './neynar/neynar.module';
import { ZoraModule } from './zora/zora.module';
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
import { EventEntity } from 'src/entities/event.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { LogicEntity } from 'src/entities/logic.entity';
import { AllowlistEntity } from 'src/entities/allowlist.entity';
import { CronModule } from './cron/cron.module';
import { AllowlistModule } from './allowlist/allowlist.module';
import { OgpModule } from './ogp/ogp.module';
import { ScorecardEntity } from 'src/entities/scorecard';
import { OfficialNFTDataEntity } from 'src/entities/officialnft_data.entity';
import { WIHCountEntity } from 'src/entities/wih_count.entity';
import { GashaModule } from './gasha/gasha.module';
import { WIHModule } from './wih/wih.module';
import { SyndicateModule } from './syndicate/syndicate.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: DB_DOMAIN,
      port: DB_PORT,
      username: DB_USERNAME,
      password: DB_PASSWORD,
      database: DB_NAME,
      entities: [
        AccountEntity,
        AllowlistEntity,
        EventEntity,
        TotalEntity,
        LogicEntity,
        ScorecardEntity,
        OfficialNFTDataEntity,
        WIHCountEntity,
      ],
      synchronize: true,
    }),
    // ScheduleModule.forRoot(),
    NeynarModule,
    ZoraModule,
    ViemModule,
    PointsModule,
    // CronModule,
    AllowlistModule,
    OgpModule,
    GashaModule,
    SyndicateModule,
    WIHModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
