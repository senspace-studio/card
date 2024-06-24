import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { WarService } from './war.service';
import { NeynarService } from '../neynar/neynar.service';
import { Address } from 'viem';

@Controller('war')
export class WarController {
  private readonly logger = new Logger(WarController.name);
  constructor(
    private readonly warService: WarService,
    private readonly neynarService: NeynarService,
  ) {}

  // ToDo: 開発用なので削除
  // @Get('/sign/:tokenId')
  // async signGet(@Param('tokenId') tokenId: string) {
  //   for (let i = 0; i < 100; i++) {
  //     try {
  //       const seed = Math.floor(Math.random() * 1000000);
  //       const signature = await this.warService.createNewGame(
  //         '0xD0575cA24D907b35d39383a53c3300D510446BaE',
  //         BigInt(tokenId),
  //         BigInt(seed),
  //       );
  //       return signature;
  //     } catch (error) {
  //       if (error.message !== 'signature already used') {
  //         throw new Error(error);
  //       }
  //     }
  //   }
  // }

  @Get('/balanceOf/:address/:tokenId')
  async balanceOf(
    @Param('address') address: Address,
    @Param('tokenId') tokenId: string,
  ) {
    this.logger.log(this.balanceOf.name, { address, tokenId });
    const { balanceOfAll } = await this.warService.getCardBalanceOf(address);
    return Number(balanceOfAll[Number(tokenId) - 1]);
  }

  // チャレンジャー待ちのゲームすべてを返す。
  @Get('/getAllReservedGames')
  async getAllReservedGames(@Param('orderBy') orderBy: 'ASC' | 'DESC') {
    const games = await this.warService.getAllReservedGames(orderBy || 'ASC');
    return games.map((game) => {
      const { game_id, maker, created } = game;
      return { game_id, maker, created: Number(created) };
    });
  }

  // チャレンジャー待ちのランダムなゲームを返す。
  // makerを渡すと、そのmakerによって作られたゲームのみ返す
  // exept_makerを渡すと、そのmakerによって作られたゲームは除外して返す
  @Get('/getRandomChallengableGame')
  async getRandomChallengableGame(
    @Query('maker') maker: string,
    @Query('exept_maker') exept_maker: string,
  ) {
    const game = await this.warService.getRandomChallengableGame({
      maker,
      exept_maker,
    });
    return game
      ? {
          game_id: game.game_id,
          maker: game.maker,
          created: Number(game.created),
        }
      : {
          game_id: '',
          maker: '',
          created: 0,
        };
  }

  // 予約済のカード枚数を返す。
  @Post('/getReservedCards')
  async getReservedCard(
    @Body('trustedData') trustedData: { messageBytes: string },
    @Body('messageBytes') messageBytes: string,
  ) {
    this.logger.log(this.getReservedCard.name, { trustedData, messageBytes });
    const result = await this.neynarService.validateRequest(
      messageBytes || trustedData.messageBytes,
    );
    if (
      !result.valid ||
      !result.action.interactor.verified_addresses.eth_addresses[0]
    ) {
      throw new Error('invalid message');
    }
    const maker = result.action.interactor.verified_addresses.eth_addresses[0];
    return await this.warService.getAllReservedCards(maker);
  }

  // 選んだTokenIDを認識して署名
  @Post('/sign')
  async sign(@Body('messageBytes') messageBytes: string) {
    this.logger.log(this.sign.name, { messageBytes });
    const result = await this.neynarService.validateRequest(messageBytes);
    if (!result.valid) {
      throw new Error('invalid message');
    }
    const maker = result.action.interactor.verified_addresses.eth_addresses[0];
    const cardInput = result.action.input.text;

    const tokenId = this.warService.convertCardValue(cardInput);

    const hasToken = await this.warService.hasCard(maker, Number(tokenId));
    if (!hasToken) {
      throw new Error('Insufficient balance');
    }
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
