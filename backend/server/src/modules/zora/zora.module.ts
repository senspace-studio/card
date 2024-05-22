import { Module } from '@nestjs/common';
import { ZoraService } from './zora.service';

@Module({
  providers: [ZoraService],
  exports: [ZoraService],
})
export class ZoraModule {}
