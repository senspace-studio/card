import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { NeynarModule } from 'src/modules/neynar/neynar.module';
import { ViemModule } from 'src/modules/viem/viem.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity, TotalEntity, HeatScoreEntity]),
    NeynarModule,
    ViemModule,
  ],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
