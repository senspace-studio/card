import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JsonRpcProvider, Wallet, getBytes, keccak256 } from 'ethers';
import { encodePacked } from 'viem';
import { WarEntity } from 'src/entities/war.entity';
import { DEALER_PRIVATE_KEY } from 'src/utils/env';
import { Repository } from 'typeorm';

const provider = new JsonRpcProvider(
  'https://nitrorpc-degen-mainnet-1.t.conduit.xyz',
);
const dealar = new Wallet(DEALER_PRIVATE_KEY, provider);

@Injectable()
export class WarService {
  constructor(
    @InjectRepository(WarEntity)
    private readonly warRepositry: Repository<WarEntity>,
  ) {}

  async getWarGameBySignature(signature: string) {
    return await this.warRepositry.findOne({ where: { signature } });
  }

  async getWarGameByGameId(gameId: string) {
    return await this.warRepositry.findOne({ where: { game_id: gameId } });
  }

  async createNewGame(maker: string, tokenId: bigint, seed: bigint) {
    const messageHash = keccak256(
      encodePacked(['uint256', 'uint256'], [tokenId, seed]),
    );
    const signature = await dealar.signMessage(getBytes(messageHash));
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
