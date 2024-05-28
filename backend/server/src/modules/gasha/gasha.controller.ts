import { Controller, Get, Logger, Post } from '@nestjs/common';
import { NeynarService } from '../neynar/neynar.service';
import { ViemService } from '../viem/viem.service';
import tweClient from 'src/lib/thirdwebEngine';

@Controller('gasha')
export class GashaController {
  private readonly logger = new Logger(GashaController.name);
  constructor(
    private readonly neynarService: NeynarService,
    private readonly viemService: ViemService,
  ) {}

  @Get('/engine/test')
  async test() {
    this.logger.log(this.test.name);

    const { data } = await tweClient.GET(
      '/contract/{chain}/{contractAddress}/read',
      {
        params: {
          query: {
            functionName: 'seriesItems',
          },
          path: {
            chain: '666666666',
            contractAddress: '0x409467ad8Ca45eA5626747c6538AbCACb7e0A292',
          },
        },
      },
    );

    return data;
  }

  @Post('/engine/spin')
  async spinGashaEngine() {
    this.logger.log(this.spinGashaEngine.name);
  }
}
