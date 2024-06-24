import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Address, encodePacked, keccak256 } from 'viem';
import { http, createPublicClient } from 'viem';
import { degen } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { WarEntity } from 'src/entities/war.entity';
import {
  BLOCKCHAIN_API,
  DEALER_PRIVATE_KEY,
  ERC1155_ADDRESS,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import { Between, MoreThan, IsNull, Repository } from 'typeorm';
import { ERC1155ABI } from 'src/constants/ERC1155';
import tweClient from 'src/lib/thirdweb-engine';

export enum GAME_STATUS {
  // データが存在しない
  NOT_FOUND,
  // DB上に作成されていてブロックチェーンには登録されていない
  CREATED,
  // ゲームがブロックチェーン上に登録されてチャレンジャー待ち
  MADE,
  MADE_CASTED,
  // チャレンジャーが現れた
  CHALLENGED,
  // 公開待ち
  WAITING_REVEAL,
  // 結果が公開された
  REVEALED,
  // DB上には存在するが期限切れ
  EXPIRED,
  // その他
  UNEXPECTED,
}

const dealar = privateKeyToAccount(DEALER_PRIVATE_KEY as `0x${string}`);
const client = createPublicClient({
  chain: degen,
  transport: http(BLOCKCHAIN_API),
});

@Injectable()
export class WarService {
  private readonly logger = new Logger(WarService.name);

  constructor(
    @InjectRepository(WarEntity)
    private readonly warRepositry: Repository<WarEntity>,
  ) {}

  getGameStatus(game: WarEntity) {
    this.logger.log(this.getGameStatus.name);
    if (game) {
      if (game.game_id) {
        if (game.cast_hash_revealed) {
          return GAME_STATUS.REVEALED;
        } else if (game.cast_hash_challenged) {
          return GAME_STATUS.WAITING_REVEAL;
        } else if (game.challenger) {
          return GAME_STATUS.CHALLENGED;
        } else if (game.cast_hash_made || game.signature) {
          const now = new Date().getTime();
          const expiration = 24 * 60 * 60 * 1e3;
          if (now < Number(game.created) + expiration) {
            if (game.cast_hash_made) {
              return GAME_STATUS.MADE_CASTED;
            } else {
              return GAME_STATUS.MADE;
            }
          } else {
            return GAME_STATUS.EXPIRED;
          }
        } else {
          return GAME_STATUS.UNEXPECTED;
        }
      } else {
        return GAME_STATUS.CREATED;
      }
    } else {
      return GAME_STATUS.NOT_FOUND;
    }
  }

  async getCardBalanceOf(owner: Address) {
    this.logger.log(this.getCardBalanceOf.name, JSON.stringify({ owner }));
    const numOfToken = 14;
    const ids = Array(numOfToken)
      .fill('')
      .map((_, i) => BigInt(i + 1));

    const res = await client.readContract({
      address: ERC1155_ADDRESS as Address,
      abi: ERC1155ABI,
      functionName: 'balanceOfBatch',
      args: [Array(numOfToken).fill(owner), ids],
    });

    return { balanceOfAll: res, ids };
  }

  async hasCard(owner: string, tokenId: number) {
    this.logger.log(this.hasCard.name, JSON.stringify({ owner, tokenId }));
    const { balanceOfAll } = await this.getCardBalanceOf(owner as Address);
    return 0n < balanceOfAll[tokenId - 1];
  }

  async getAllReservedGames(orderBy: 'ASC' | 'DESC' = 'ASC') {
    this.logger.log(this.getAllReservedGames.name, JSON.stringify({ orderBy }));
    const now = new Date();
    const games = await this.warRepositry.find({
      where: {
        created: MoreThan(
          new Date(now.getTime() - 24 * 60 * 60 * 1e3).getTime().toString(),
        ),
      },
      order: { created: orderBy },
    });
    // this.logger.debug(JSON.stringify(games));
    const reservedGamnes = games.filter(
      (e) =>
        this.getGameStatus(e) === GAME_STATUS.MADE ||
        this.getGameStatus(e) === GAME_STATUS.MADE_CASTED,
    );
    // this.logger.debug(JSON.stringify(reservedGamnes));
    return reservedGamnes;
  }

  async getAllReservedGamesByMaker(
    maker: string,
    orderBy: 'ASC' | 'DESC' = 'ASC',
  ) {
    this.logger.log(
      this.getAllReservedGamesByMaker.name,
      JSON.stringify({ maker, orderBy }),
    );
    const games = await this.warRepositry.find({
      where: { maker },
      order: { created: orderBy },
    });
    const reservedGamnes = games.filter(
      (e) =>
        this.getGameStatus(e) === GAME_STATUS.MADE ||
        this.getGameStatus(e) === GAME_STATUS.MADE_CASTED,
    );
    // games.map((e) => {
    //   this.logger.debug(GAME_STATUS[this.getGameStatus(e)]);
    // });
    return reservedGamnes;
  }

  async getAllReservedCards(maker: string) {
    this.logger.log(this.getAllReservedCards.name, JSON.stringify({ maker }));
    const games = await this.getAllReservedGamesByMaker(maker);
    const numOfCards: number[] = [...new Array(14)].fill(0);

    for (const game of games) {
      numOfCards[Number(game.maker_token_id) - 1]++;
    }
    return numOfCards;
  }

  async getRandomChallengableGame(maker?: string) {
    this.logger.log(
      this.getRandomChallengableGame.name,
      JSON.stringify({ maker }),
    );
    const now = new Date();
    const games = await this.warRepositry.find({
      where: {
        challenger: IsNull(),
        maker,
        // 2時間以上経過24時間は経過してない
        created: Between(
          new Date(now.getTime() - 24 * 60 * 60 * 1e3).getTime().toString(),
          new Date(now.getTime() - 2 * 60 * 60 * 1e3).getTime().toString(),
        ),
      },
    });
    const index = Math.floor(Math.random() * games.length);
    return games[index];
  }

  async getWarGameBySignature(signature: string) {
    this.logger.log(
      this.getWarGameBySignature.name,
      JSON.stringify({ signature }),
    );
    return await this.warRepositry.findOne({ where: { signature } });
  }

  async getWarGameByGameId(gameId: string) {
    this.logger.log(this.getWarGameByGameId.name, JSON.stringify({ gameId }));
    return await this.warRepositry.findOne({ where: { game_id: gameId } });
  }

  async createNewGame(maker: string, tokenId: bigint, seed: bigint) {
    this.logger.log(
      this.createNewGame.name,
      JSON.stringify({
        maker,
        tokenId: Number(tokenId),
        seed: Number(seed),
      }),
    );
    const messageHash = keccak256(
      encodePacked(['uint256', 'uint256'], [tokenId, seed]),
    ) as `0x${string}`;
    this.logger.debug(JSON.stringify({ messageHash }));
    const signature = await dealar.signMessage({
      message: { raw: messageHash },
    });
    this.logger.debug(JSON.stringify({ signature }));
    const game = await this.getWarGameBySignature(signature);
    const status = this.getGameStatus(game);
    const requiredStatus = GAME_STATUS.NOT_FOUND;
    if (status !== requiredStatus) {
      throw new Error(
        `invalid game status (required: ${requiredStatus}, but: ${status})`,
      );
    }
    await this.warRepositry.save({
      seed: seed.toString(),
      maker,
      maker_token_id: tokenId.toString(),
      signature: signature,
      created: new Date().getTime().toString(),
    });
    return signature;
  }

  async onGameMade(gameId: string, signature: string) {
    this.logger.log(
      this.getWarGameByGameId.name,
      JSON.stringify({
        gameId,
        signature,
      }),
    );
    const game = await this.getWarGameBySignature(signature);
    const status = this.getGameStatus(game);
    const requiredStatus = GAME_STATUS.CREATED;
    if (status !== requiredStatus) {
      throw new Error(
        `invalid game status (required: ${requiredStatus}, but: ${status})`,
      );
    }
    game.game_id = gameId;
    await this.warRepositry.save(game);
  }
  async onGameMadeCasted(gameId: string, castHash: string) {
    this.logger.log(
      this.getWarGameByGameId.name,
      JSON.stringify({
        gameId,
        castHash,
      }),
    );
    const game = await this.getWarGameByGameId(gameId);
    const status = this.getGameStatus(game);
    const requiredStatus = GAME_STATUS.MADE;
    if (status !== requiredStatus) {
      throw new Error(
        `invalid game status (required: ${requiredStatus}, but: ${status})`,
      );
    }
    game.cast_hash_made = castHash;
    await this.warRepositry.save(game);
  }

  async onGameChallenged(gameId: string, challenger: string) {
    this.logger.log(
      this.onGameChallenged.name,
      JSON.stringify({
        gameId,
        challenger,
      }),
    );
    const game = await this.getWarGameByGameId(gameId);
    const status = this.getGameStatus(game);
    const requiredStatus0 = GAME_STATUS.MADE;
    const requiredStatus1 = GAME_STATUS.MADE_CASTED;
    if (!(status === requiredStatus0 || status === requiredStatus1)) {
      throw new Error(
        `invalid game status (required: ${requiredStatus0} or ${requiredStatus1}, but: ${status})`,
      );
    }
    game.challenger = challenger;
    await this.warRepositry.save(game);
  }

  async onGameChallengedCasted(gameId: string, castHash: string) {
    this.logger.log(
      this.onGameChallenged.name,
      JSON.stringify({
        gameId,
        castHash,
      }),
    );
    const game = await this.getWarGameByGameId(gameId);
    const status = this.getGameStatus(game);
    const requiredStatus = GAME_STATUS.CHALLENGED;
    if (status !== requiredStatus) {
      throw new Error(
        `invalid game status (required: ${requiredStatus}, but: ${status})`,
      );
    }
    game.cast_hash_challenged = castHash;
    await this.warRepositry.save(game);
  }

  async onGameRevealed(gameId: string, castHash: string) {
    this.logger.log(
      this.onGameRevealed.name,
      JSON.stringify({
        gameId,
        castHash,
      }),
    );
    const game = await this.getWarGameByGameId(gameId);
    const status = this.getGameStatus(game);
    const requiredStatus = GAME_STATUS.WAITING_REVEAL;
    if (status !== requiredStatus) {
      throw new Error(
        `invalid game status (required: ${requiredStatus}, but: ${status})`,
      );
    }
    game.cast_hash_revealed = castHash;
    await this.warRepositry.save(game);
  }

  convertCardValue = (input: string) => {
    const value = input
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[０-９]/g, (char) =>
        String.fromCharCode(char.charCodeAt(0) - 0xfee0),
      );

    switch (value) {
      case 'joker':
      case 'Joker':
      case 'j':
      case 'J':
        return 14;
      case '11':
      case '１１':
      case 'jack':
      case 'Jack':
        return 11;
      case '12':
      case '１２':
      case 'q':
      case 'Q':
      case 'queen':
      case 'Queen':
        return 12;
      case '13':
      case '１３':
      case 'k':
      case 'K':
      case 'king':
      case 'King':
        return 13;
      case '1':
      case '１':
      case 'a':
      case 'A':
      case 'ace':
      case 'Ace':
        return 1;
      default:
        const num = Number(value);
        return isNaN(num) ? -1 : num;
    }
  };

  numOfGames = async (startDateUnix: number, endDateUnix: number) => {
    const {
      result: { blockNumber: fromBlock_game },
    } = await (
      await fetch(
        `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${startDateUnix}&closest=after`,
      )
    ).json();
    const {
      result: { blockNumber: toBlock_game },
    } = await (
      await fetch(
        `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${endDateUnix}&closest=after`,
      )
    ).json();

    const { data } = await tweClient.POST(
      '/contract/{chain}/{contractAddress}/events/get',
      {
        params: {
          path: {
            chain: 'degen-chain',
            contractAddress: WAR_CONTRACT_ADDRESS,
          },
        },
        body: {
          eventName: 'GameRevealed',
          fromBlock: fromBlock_game,
          toBlock: toBlock_game,
        } as never,
      },
    );

    return data.result.length;
  };
}
