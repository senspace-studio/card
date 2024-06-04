import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  RawBodyRequest,
} from '@nestjs/common';
import { EventLog, TransactionReceipt } from 'src/lib/thirdweb-engine/types';
import { NeynarService } from '../neynar/neynar.service';
import { WarService } from '../war/war.service';
import { sendTransaction } from 'src/lib/thirdweb-engine/send-transaction';
import { ENGINE_WEBHOOK_SECRET, WAR_CONTRACT_ADDRESS } from 'src/utils/env';
import * as crypto from 'node:crypto';

const generateSignature = (
  body: string,
  timestamp: string,
  secret: string,
): string => {
  const payload = `${timestamp}.${body}`;
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
};

const isValidSignature = (
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean => {
  const expectedSignature = generateSignature(body, timestamp, secret);
  console.log(expectedSignature);
  console.log(signature);
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature),
  );
};

const isExpired = (timestamp: string, expirationInSeconds: number): boolean => {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - parseInt(timestamp) > expirationInSeconds;
};

type ContractEventObject = {
  type: string;
  value: string;
};

type GameMadeEvent = {
  maker: ContractEventObject;
  signature: ContractEventObject;
  gameId: ContractEventObject;
};
type GameChallengedEvent = {
  challenger: ContractEventObject;
  gameId: ContractEventObject;
};
type GameRevealedEvent = {
  gameId: ContractEventObject;
  maker: ContractEventObject;
  challenger: ContractEventObject;
  winner: ContractEventObject;
};

@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly neynarService: NeynarService,
    private readonly warService: WarService,
  ) {}

  @Post('/')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('X-Engine-Signature') signatureFromHeader: string,
    @Headers('X-Engine-Timestamp') timestampFromHeader: string,
    @Body() body: EventLog | TransactionReceipt,
  ) {
    console.log(signatureFromHeader, timestampFromHeader);
    console.log(body);
    // const signatureFromHeader = headers['X-Engine-Signature'];
    // const timestampFromHeader = headers['X-Engine-Timestamp']

    if (!signatureFromHeader || !timestampFromHeader) {
      throw new Error('Missing signature or timestamp header');
    }
    const text = req.rawBody.toString().trim();
    console.log(text);
    if (
      !isValidSignature(
        text,
        timestampFromHeader,
        signatureFromHeader,
        ENGINE_WEBHOOK_SECRET,
      )
    ) {
      throw new Error('Invalid signature');
    }

    if (isExpired(timestampFromHeader, 300)) {
      // Assuming expiration time is 5 minutes (300 seconds)
      throw new Error('Request has expired');
    }
    console.log(body.data);
    if (body.type === 'event-log') {
      switch (body.data.eventName) {
        case 'GameMade': {
          console.log('GameMade');
          const { maker, signature, gameId } = body.data
            .decodedLog as GameMadeEvent;
          // gameIdとsignatureを紐づける
          await this.warService.onGameMade(gameId.value, signature.value);
          // ToDo: gameIdを元にゲームの情報を取得してBotからCast
          const res = await this.neynarService.publishCast(
            `[GameMade] maker:${maker.value}, id:${gameId.value}, signature:${signature.value}`,
          );
          console.log(res);
          break;
        }
        case 'GameChallenged': {
          console.log('GameChallenged');
          const { challenger, gameId } = body.data
            .decodedLog as GameChallengedEvent;
          await this.warService.onGameChallenged(
            gameId.value,
            challenger.value,
          );
          const game = await this.warService.getWarGameByGameId(gameId.value);
          // ToDo: revealトランザクションをEngine経由で実行
          // bytes8 gameId,
          // uint256 makerCard,
          // uint256 nonce
          await sendTransaction(WAR_CONTRACT_ADDRESS, 'revealCard', [
            gameId.value,
            game.maker_token_id,
            game.seed,
          ]);
          const res = await this.neynarService.publishCast(
            `[GameChallenged] challenger:${challenger.value} id:${gameId.value}`,
          );
          console.log(res);
          break;
        }
        case 'GameRevealed': {
          console.log('GameRevealed');
          // ToDo: ゲーム結果を取得
          const { gameId, maker, challenger, winner } = body.data
            .decodedLog as GameRevealedEvent;
          // const game = await this.warService.getWarGameByGameId(gameId.value);
          // const { maker, challenger } = game;
          // ToDo: BotからCast
          await this.neynarService.publishCast(
            `[GameRevealed] gameId:${gameId.value}, maker:${maker.value}, challenger:${challenger.value}, winner:${winner.value}`,
          );
          break;
        }
        default: {
          break;
        }
      }
    }
  }
}
