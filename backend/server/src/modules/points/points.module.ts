import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { NeynarModule } from 'src/modules/neynar/neynar.module';
import { ViemModule } from 'src/modules/viem/viem.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import {
  CACHE_MANAGER,
  CacheInterceptor,
  CacheModule,
} from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';

@Module({
  imports: [
    TypeOrmModule.forFeature([AccountEntity, TotalEntity, HeatScoreEntity]),
    CacheModule.register(),
  ],
  controllers: [PointsController],
  providers: [
    PointsService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CacheInterceptor,
    },
  ],
  exports: [PointsService],
})
export class PointsModule {}
