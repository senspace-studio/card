import { Module } from '@nestjs/common';
import { ViemService } from './viem.service';
import { ViemController } from './viem.controller';

@Module({
  providers: [ViemService],
  exports: [ViemService],
  controllers: [ViemController],
})
export class ViemModule {}
