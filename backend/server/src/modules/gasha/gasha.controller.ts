import { Controller, Logger, Post } from '@nestjs/common';
import { NeynarService } from '../neynar/neynar.service';
import { ViemService } from '../viem/viem.service';

@Controller('gasha')
export class GashaController {
  private readonly logger = new Logger(GashaController.name);
  constructor(
    private readonly neynarService: NeynarService,
    private readonly viemService: ViemService,
  ) {}

  @Post('/engine/spin')
  async spinGashaEngine() {
    this.logger.log(this.spinGashaEngine.name);
  }
}
