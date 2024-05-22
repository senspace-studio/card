import { Module } from '@nestjs/common';
import { NeynarService } from './neynar.service';
import { NeynarController } from './neynar.controller';

@Module({
  controllers: [NeynarController],
  providers: [NeynarService],
  exports: [NeynarService],
})
export class NeynarModule {}
