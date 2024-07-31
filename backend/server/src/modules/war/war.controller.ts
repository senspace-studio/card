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
  // @Get('/sign/:maker/:tokenIds')
  // async getSignForDev(
  //   @Param('maker') maker: string,
  //   @Param('tokenIds') tokenIds: string,
  // ) {
  //   const tokenIdList = tokenIds
  //     .split(',')
  //     .map((card) => this.warService.convertCardValue(card))
  //     .sort((a, b) => b - a);
  //   return await this.warService.sign(tokenIdList, maker);
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
  async getAllReservedGames(
    @Query('orderBy') orderBy: 'ASC' | 'DESC',
    @Query('hand_length') hand_length: string,
  ) {
    this.logger.log(this.getAllReservedGames.name, { orderBy, hand_length });
    const games = await this.warService.getAllReservedGames(
      orderBy || 'ASC',
      hand_length || '1',
    );
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
    @Query('hand_length') hand_length: string,
  ) {
    this.logger.log(this.getRandomChallengableGame.name, {
      maker,
      exept_maker,
      hand_length,
    });
    const game = await this.warService.getRandomChallengableGame({
      maker,
      exept_maker,
      hand_length,
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
    const cardInputList = result.action.input.text.split(',');
    const tokenIdList = cardInputList
      .map((cardInput) => this.warService.convertCardValue(cardInput))
      .sort((a, b) => b - a);
    return await this.warService.sign(tokenIdList, maker);
  }

  @Post('/sign-tournament')
  async signTournament(@Body('messageBytes') messageBytes: string) {
    this.logger.log(this.signTournament.name, { messageBytes });
    const result = await this.neynarService.validateRequest(messageBytes);
    if (!result.valid) {
      throw new Error('invalid message');
    }
    const maker = result.action.interactor.verified_addresses.eth_addresses[0];
    const cardInputList = result.action.input.text.split(',');
    const tokenIdList = cardInputList
      .map((cardInput) => this.warService.convertCardValue(cardInput))
      .sort((a, b) => b - a);
    return await this.warService.signTournament(tokenIdList, maker);
  }
}
