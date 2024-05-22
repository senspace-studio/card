import { Controller, Get, Logger, Param } from '@nestjs/common';
import { ViemService } from 'src/modules/viem/viem.service';
import { Address } from 'viem';

@Controller('viem')
export class ViemController {
  private readonly logger = new Logger(ViemController.name);
  constructor(private readonly viemService: ViemService) {}

  @Get('/balanceOf/:address')
  async getHoldingTokens(@Param('address') address: Address) {
    this.logger.log(this.getHoldingTokens.name);
    const balance = await this.viemService.balanceOf(address);
    return { balance: balance.map((b) => Number(b)) };
  }
}
