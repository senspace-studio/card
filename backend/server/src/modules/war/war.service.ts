import { Injectable } from '@nestjs/common';
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

const dealar = privateKeyToAccount(DEALER_PRIVATE_KEY as `0x${string}`);
const client = createPublicClient({
  chain: degen,
  transport: http(BLOCKCHAIN_API),
});

@Injectable()
export class WarService {
  constructor(
    @InjectRepository(WarEntity)
    private readonly warRepositry: Repository<WarEntity>,
  ) {}

  async getCardBalanceOf(owner: Address) {
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
    const { balanceOfAll } = await this.getCardBalanceOf(owner as Address);
    return 0n < balanceOfAll[tokenId - 1];
  }

  async getWarGameBySignature(signature: string) {
    return await this.warRepositry.findOne({ where: { signature } });
  }

  async getWarGameByGameId(gameId: string) {
    return await this.warRepositry.findOne({ where: { game_id: gameId } });
  }

  async createNewGame(maker: string, tokenId: bigint, seed: bigint) {
    const messageHash = keccak256(
      encodePacked(['uint256', 'uint256'], [tokenId, seed]),
    ) as `0x${string}`;
    const signature = await dealar.signMessage({
      message: { raw: messageHash },
    });
    const game = await this.getWarGameBySignature(signature);
    if (game) {
      throw new Error('signature already used');
    }
    await this.warRepositry.save({
      seed: seed.toString(),
      maker,
      maker_token_id: tokenId.toString(),
      signature: signature,
    });
    return signature;
  }

  async onGameMade(gameId: string, signature: string) {
    const game = await this.getWarGameBySignature(signature);
    if (!game) {
      throw new Error('game not found');
    }
    if (game.game_id) {
      throw new Error('game id already linked');
    }
    game.game_id = gameId;
    await this.warRepositry.save(game);
  }

  async onGameChallenged(
    gameId: string,
    challenger: string,
    // challengerTokenId: bigint,
  ) {
    const game = await this.getWarGameByGameId(gameId);
    if (!game) {
      throw new Error('game not found');
    }
    game.challenger = challenger;
    // game.challenger_token_id = challengerTokenId.toString();
    await this.warRepositry.save(game);
  }

  // async onGameRevealed(gameId: string) {}
}
