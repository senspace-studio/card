import { Module } from '@nestjs/common';
import { EngineService } from './engine.service';

@Module({
  providers: [EngineService],
})
export class EngineModule {}
