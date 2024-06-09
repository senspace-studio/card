import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { NeynarModule } from '../neynar/neynar.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WarEntity } from 'src/entities/war.entity';
import { WarModule } from '../war/war.module';

@Module({
  imports: [NeynarModule, WarModule, TypeOrmModule.forFeature([WarEntity])],
  controllers: [WebhookController],
})
export class WebhookModule {}
