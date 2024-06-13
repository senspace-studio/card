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
} from 'src/utils/env';
import { Repository } from 'typeorm';
import { ERC1155ABI } from 'src/constants/ERC1155';

export enum GAME_STATUS {
  // データが存在しない
  NOT_FOUND,
  // DB上に作成されていてブロックチェーンには登録されていない
  CREATED,
  // ゲームがブロックチェーン上に登録されてチャレンジャー待ち
  MADE,
  // チャレンジャーが現れた
  CHALLENGED,
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
    this.logger.log(this.getGameStatus.name, game);
    if (game) {
      if (game.game_id) {
        if (game.cast_hash_revealed) {
          return GAME_STATUS.REVEALED;
        } else if (game.cast_hash_challenged) {
          return GAME_STATUS.CHALLENGED;
        } else if (game.cast_hash_made) {
          const now = new Date().getTime();
          const expiration = 24 * 60 * 60 * 1e3;
          if (Number(game.created) + expiration < now) {
            return GAME_STATUS.MADE;
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
    this.logger.log(this.getCardBalanceOf.name, { owner });
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
    this.logger.log(this.hasCard.name, { owner, tokenId });
    const { balanceOfAll } = await this.getCardBalanceOf(owner as Address);
    return 0n < balanceOfAll[tokenId - 1];
  }

  async getAllReservedGames(maker: string) {
    this.logger.log(this.getAllReservedGames.name, { maker });
    const games = await this.warRepositry.find({ where: { maker } });
    const reservedGamnes = games.filter(
      (e) => this.getGameStatus(e) === GAME_STATUS.MADE,
    );
    return reservedGamnes;
  }

  async getAllReservedCards(maker: string) {
    this.logger.log(this.getAllReservedCards.name, { maker });
    const games = await this.getAllReservedGames(maker);
    const numOfCards: number[] = [...new Array(14)].fill(0);
    for (const game of games) {
      numOfCards[Number(game.maker_token_id) - 1]++;
    }
    return numOfCards;
  }

  async getWarGameBySignature(signature: string) {
    this.logger.log(this.getWarGameBySignature.name, { signature });
    return await this.warRepositry.findOne({ where: { signature } });
  }

  async getWarGameByGameId(gameId: string) {
    this.logger.log(this.getWarGameByGameId.name, { gameId });
    return await this.warRepositry.findOne({ where: { game_id: gameId } });
  }

  async createNewGame(maker: string, tokenId: bigint, seed: bigint) {
    this.logger.log(this.createNewGame.name, {
      maker,
      tokenId: Number(tokenId),
      seed: Number(seed),
    });
    const messageHash = keccak256(
      encodePacked(['uint256', 'uint256'], [tokenId, seed]),
    ) as `0x${string}`;
    this.logger.debug({ messageHash });
    const signature = await dealar.signMessage({
      message: { raw: messageHash },
    });
    this.logger.debug({ signature });
    const game = await this.getWarGameBySignature(signature);
    if (game) {
      this.logger.debug({ game });
      throw new Error('signature already used');
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

  async onGameMade(gameId: string, signature: string, cashHash: string) {
    this.logger.log(this.getWarGameByGameId.name, {
      gameId,
      signature,
      cashHash,
    });
    const game = await this.getWarGameBySignature(signature);
    if (this.getGameStatus(game) !== GAME_STATUS.CREATED) {
      throw new Error('invalid game status');
    }
    game.game_id = gameId;
    game.cast_hash_made = cashHash;
    await this.warRepositry.save(game);
  }

  async onGameChallenged(gameId: string, challenger: string, cashHash: string) {
    this.logger.log(this.onGameChallenged.name, {
      gameId,
      challenger,
      cashHash,
    });
    const game = await this.getWarGameByGameId(gameId);
    if (this.getGameStatus(game) !== GAME_STATUS.MADE) {
      throw new Error('invalid game status');
    }
    game.challenger = challenger;
    game.cast_hash_challenged = cashHash;
    await this.warRepositry.save(game);
  }

  async onGameRevealed(gameId: string, cashHash: string) {
    this.logger.log(this.onGameRevealed.name, {
      gameId,
      cashHash,
    });
    const game = await this.getWarGameByGameId(gameId);
    if (this.getGameStatus(game) !== GAME_STATUS.CHALLENGED) {
      throw new Error('invalid game status');
    }
    game.cast_hash_revealed = cashHash;
    await this.warRepositry.save(game);
  }
}
