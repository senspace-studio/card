import { Controller, Get, Logger, Post } from '@nestjs/common';
import { NeynarService } from '../neynar/neynar.service';
import { ViemService } from '../viem/viem.service';
import tweClient from 'src/lib/thirdweb-engine';
import { WAR_CONTRACT_ADDRESS } from 'src/utils/env';

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

    const { data } = await tweClient.POST(
      '/contract/{chain}/{contractAddress}/events/get',
      {
        params: {
          path: {
            chain: 'degen-chain',
            contractAddress: '0xAc49FAdA594056Bf878704753A04D812D450FBfa',
          },
        },
        body: {
          eventName: 'GameRevealed',
          // Filterが効かないので調査必要
          filters: {
            gameId: '0xb701f8373853bdd2',
          },
        } as never,
      },
    );

    return data;
  }

  @Post('/engine/spin')
  async spinGashaEngine() {
    this.logger.log(this.spinGashaEngine.name);
  }
}
