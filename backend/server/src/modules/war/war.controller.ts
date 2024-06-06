import { Body, Controller, Get, Logger, Post } from '@nestjs/common';
import { WarService } from './war.service';
import { NeynarService } from '../neynar/neynar.service';

@Controller('war')
export class WarController {
  private readonly logger = new Logger(WarController.name);
  constructor(
    private readonly warService: WarService,
    private readonly neynarService: NeynarService,
  ) {}

  // // ToDo: 開発用なので削除
  // @Get('/sign')
  // async signGet() {
  //   for (let i = 0; i < 100; i++) {
  //     try {
  //       const seed = Math.floor(Math.random() * 1000000);
  //       const signature = await this.warService.createNewGame(
  //         '0xD0575cA24D907b35d39383a53c3300D510446BaE',
  //         BigInt(3),
  //         BigInt(seed),
  //       );
  //       return signature;
  //     } catch (error) {
  //       if (error.message !== 'signature already used') {
  //         throw new Error('Internal server error');
  //       }
  //     }
  //   }
  // }

  // ToDo: 選んだTokenIDを認識
  @Post('/sign')
  async sign(@Body('messageBytes') messageBytes: string) {
    // @Body('maker') maker: string, @Body('tokenId') tokenId: string
    this.logger.log(this.sign.name);
    const result = await this.neynarService.validateRequest(messageBytes);
    if (!result.valid) {
      throw new Error('invalid message');
    }
    const maker = result.action.address;
    // const tokenId = result.action.tapped_button.index;
    const tokenId = '3';
    for (let i = 0; i < 100; i++) {
      try {
        const seed = Math.floor(Math.random() * 1000000);
        const signature = await this.warService.createNewGame(
          maker,
          BigInt(tokenId),
          BigInt(seed),
        );
        return signature;
      } catch (error) {
        if (error.message !== 'signature already used') {
          throw new Error('Internal server error');
        }
      }
    }
  }
}
