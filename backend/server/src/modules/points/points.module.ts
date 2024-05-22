import { Module } from '@nestjs/common';
import { PointsController } from './points.controller';
import { PointsService } from './points.service';
import { ZoraModule } from 'src/modules/zora/zora.module';
import { NeynarModule } from 'src/modules/neynar/neynar.module';
import { ViemModule } from 'src/modules/viem/viem.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from 'src/entities/event.entity';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { LogicEntity } from 'src/entities/logic.entity';
import { OfficialNFTDataEntity } from 'src/entities/officialnft_data.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventEntity,
      AccountEntity,
      TotalEntity,
      LogicEntity,
      OfficialNFTDataEntity,
    ]),
    NeynarModule,
    ZoraModule,
    ViemModule,
  ],
  controllers: [PointsController],
  providers: [PointsService],
  exports: [PointsService],
})
export class PointsModule {}
