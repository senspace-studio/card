import { Module } from '@nestjs/common';
import { SyndicateService } from './syndicate.service';

@Module({
  providers: [SyndicateService],
  exports: [SyndicateService],
})
export class SyndicateModule {}
