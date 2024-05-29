import { Module } from '@nestjs/common';
import { OgpService } from './ogp.service';
import { ViemModule } from '../viem/viem.module';
import { OgpController } from './ogp.controller';
import { PointsModule } from '../points/points.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScorecardEntity } from 'src/entities/scorecard';
import { PointsService } from '../points/points.service';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { ViemService } from '../viem/viem.service';

@Module({
  imports: [
    ViemModule,
    PointsModule,
    TypeOrmModule.forFeature([ScorecardEntity, AccountEntity, TotalEntity]),
  ],
  controllers: [OgpController],
  providers: [OgpService, PointsService, ViemService],
})
export class OgpModule {}
