import { Module } from '@nestjs/common';
import { GashaController } from './gasha.controller';
import { SyndicateModule } from '../syndicate/syndicate.module';
import { NeynarModule } from '../neynar/neynar.module';
import { ViemModule } from '../viem/viem.module';

@Module({
  imports: [SyndicateModule, NeynarModule, ViemModule],
  controllers: [GashaController],
})
export class GashaModule {}
