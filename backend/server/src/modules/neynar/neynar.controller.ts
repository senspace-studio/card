import { Body, Controller, Get, Logger, Param, Post } from '@nestjs/common';
import { Address } from 'viem';
import { NeynarService } from './neynar.service';

@Controller('neynar')
export class NeynarController {
  private readonly logger = new Logger(NeynarController.name);
  constructor(private readonly neynarService: NeynarService) {}

  @Post('/frame/validate')
  async getHoldingTokens(@Body('messageBytes') messageBytes: string) {
    this.logger.log(this.getHoldingTokens.name);
    return await this.neynarService.validateRequest(messageBytes);
  }
}
