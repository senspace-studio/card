import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { ViemService } from '../viem/viem.service';
import { PointsService } from '../points/points.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import { StreamSmartAccountEntity } from 'src/entities/stream_smartaccount';
import { WarService } from '../war/war.service';
import { WarEntity } from 'src/entities/war.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      TotalEntity,
      HeatScoreEntity,
      StreamSmartAccountEntity,
      WarEntity,
    ]),
  ],
  providers: [ViemService, PointsService, CronService, WarService],
})
export class CronModule {}
