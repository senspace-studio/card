import { Module } from '@nestjs/common';
import { CronService } from './cron.service';
import { ViemService } from '../viem/viem.service';
import { PointsService } from '../points/points.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import { StreamSmartAccountEntity } from 'src/entities/stream_smartaccount';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AccountEntity,
      TotalEntity,
      HeatScoreEntity,
      StreamSmartAccountEntity,
    ]),
  ],
  providers: [ViemService, PointsService, CronService],
})
export class CronModule {}
