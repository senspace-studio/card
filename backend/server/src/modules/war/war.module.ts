import { Module } from '@nestjs/common';
import { WarService } from './war.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarEntity } from 'src/entities/war.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WarEntity])],
  providers: [WarService],
  exports: [WarService],
})
export class WarModule {}
