import { Module } from '@nestjs/common';
import { WarService } from './war.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarEntity } from 'src/entities/war.entity';
import { WarController } from './war.controller';
import { NeynarModule } from '../neynar/neynar.module';
import { PointsService } from '../points/points.service';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([WarEntity, HeatScoreEntity]),
    NeynarModule,
  ],
  providers: [WarService, PointsService],
  exports: [WarService],
  controllers: [WarController],
})
export class WarModule {}
