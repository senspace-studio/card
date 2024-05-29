import { Module } from '@nestjs/common';
import { GashaController } from './gasha.controller';
import { NeynarModule } from '../neynar/neynar.module';
import { ViemModule } from '../viem/viem.module';

@Module({
  imports: [NeynarModule, ViemModule],
  controllers: [GashaController],
})
export class GashaModule {}
