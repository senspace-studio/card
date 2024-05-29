import { Body, Controller, Post } from '@nestjs/common';
import { EventLog, TransactionReceipt } from 'src/lib/thirdweb-engine/types';

@Controller('webhook')
export class WebhookController {
  @Post('/')
  async webhook(@Body() body: EventLog | TransactionReceipt) {
    if (body.type === 'event-log') {
      switch (body.data.eventName) {
        case 'GameCreated': {
          console.log('GameCreated');
          // ToDo: gameIdとsignatureを紐づける

          // ToDo: gameIdを元にゲームの情報を取得してBotからCast

          break;
        }
        case 'GameChallenged': {
          console.log('GameChallenged');
          // ToDo: revealトランザクションをEngine経由で実行

          break;
        }
        case 'GameRevealed': {
          console.log('GameRevealed');
          // ToDo: ゲーム結果を取得してBotからCast

          break;
        }
      }
    }
  }
}
