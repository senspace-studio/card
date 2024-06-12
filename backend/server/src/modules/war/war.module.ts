import { Module } from '@nestjs/common';
import { WarService } from './war.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarEntity } from 'src/entities/war.entity';
import { WarController } from './war.controller';
import { NeynarModule } from '../neynar/neynar.module';

@Module({
  imports: [TypeOrmModule.forFeature([WarEntity]), NeynarModule],
  providers: [WarService],
  exports: [WarService],
  controllers: [WarController],
})
export class WarModule {}
