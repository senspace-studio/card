import { Module } from '@nestjs/common';
import { WarService } from './war.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarEntity } from 'src/entities/war.entity';
import { WarController } from './war.controller';
import { NeynarModule } from '../neynar/neynar.module';
import { PointsService } from '../points/points.service';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import { StreamSmartAccountEntity } from 'src/entities/stream_smartaccount';
import { ViemService } from '../viem/viem.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WarEntity,
      HeatScoreEntity,
      StreamSmartAccountEntity,
    ]),
    NeynarModule,
  ],
  providers: [WarService, ViemService],
  exports: [WarService],
  controllers: [WarController],
})
export class WarModule {}
