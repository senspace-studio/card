import { Body, Controller,Get, Headers, Post } from '@nestjs/common';
import { EventLog, TransactionReceipt } from 'src/lib/thirdweb-engine/types';
import { NeynarService } from '../neynar/neynar.service';
import { WarService } from '../war/war.service';
import crypto from 'crypto';

const generateSignature = (
  body: string,
  timestamp: string,
  secret: string,
): string => {
  const payload = `${timestamp}.${body}`;
  return crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
};

const isValidSignature = (
  body: string,
  timestamp: string,
  signature: string,
  secret: string,
): boolean => {
  const expectedSignature = generateSignature(
    body,
    timestamp,
    secret,
  );
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(signature),
  );
};

const isExpired = (
  timestamp: string,
  expirationInSeconds: number,
): boolean => {
  const currentTime = Math.floor(Date.now() / 1000);
  return currentTime - parseInt(timestamp) > expirationInSeconds;
};


@Controller('webhook')
export class WebhookController {
  constructor(
    private readonly neynarService: NeynarService,
    private readonly warService: WarService,
  ) {}

  @Post('/')
  async webhook(@Headers() headers, @Body() body: EventLog | TransactionReceipt) {
    // const signatureFromHeader = headers['X-Engine-Signature'];
    // const timestampFromHeader = headers['X-Engine-Timestamp']
   
    // if (!signatureFromHeader || !timestampFromHeader) {
    //   throw new Error('Missing signature or timestamp header');
    // }
   
    // if (
    //   !isValidSignature(
    //     JSON.stringify(body),
    //     timestampFromHeader,
    //     signatureFromHeader,
    //     WEBHOOK_SECRET,
    //   )
    // ) {
    //   throw new Error('Invalid signature');
    // }
   
    // if (isExpired(timestampFromHeader, 300)) {
    //   // Assuming expiration time is 5 minutes (300 seconds)
    //   return res.status(401).send("Request has expired");
    // }

    if (body.type === 'event-log') {
      switch (body.data.eventName) {
        case 'GameCreated': {
          console.log('GameCreated');
          console.log(body.data.data);
          body.data.topics
          // ToDo: gameIdとsignatureを紐づける
          // await this.warService.onGameCreated(gameId, signature);

          // ToDo: gameIdを元にゲームの情報を取得してBotからCast
          // this.neynarService.publishCast
          break;
        }
        case 'GameChallenged': {
          console.log('GameChallenged');
          console.log(body.data.data);
          // await this.warService.onGameChallenged(gameId, challenger);
          // ToDo: revealトランザクションをEngine経由で実行

          break;
        }
        case 'GameRevealed': {
          console.log('GameRevealed');
          // ToDo: ゲーム結果を取得してBotからCast
          this.neynarService.publishCast('', '');
          break;
        }
      }
    }
  }
}
