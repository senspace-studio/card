import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllowlistEntity } from 'src/entities/allowlist.entity';
import { NeynarModule } from '../neynar/neynar.module';
import { AllowlistController } from './allowlist.controller';
import { AllowlistService } from './allowlist.service';
import { ViemModule } from '../viem/viem.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AllowlistEntity]),
    NeynarModule,
    ViemModule,
  ],
  controllers: [AllowlistController],
  providers: [AllowlistService],
  exports: [AllowlistService],
})
export class AllowlistModule {}
