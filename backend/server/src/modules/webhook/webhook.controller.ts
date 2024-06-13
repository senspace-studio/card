import {
  Body,
  Controller,
  Headers,
  Post,
  Req,
  RawBodyRequest,
  Logger,
} from '@nestjs/common';
import { EventLog, TransactionReceipt } from 'src/lib/thirdweb-engine/types';
import { NeynarService } from '../neynar/neynar.service';
import { WarService } from '../war/war.service';
import { sendTransaction } from 'src/lib/thirdweb-engine/send-transaction';
import {
  // ENGINE_WEBHOOK_SECRET,
  FRAME_BASE_URL,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import * as crypto from 'node:crypto';
import { zeroAddress } from 'viem';

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
  console.log(JSON.stringify({ signature, expectedSignature }));
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
  private readonly logger = new Logger(WebhookController.name);
  constructor(
    private readonly neynarService: NeynarService,
    private readonly warService: WarService,
  ) {}

  @Post('/')
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('Authorization') authorization: string,
    @Headers('X-Engine-Signature') signatureFromHeader: string,
    @Headers('X-Engine-Timestamp') timestampFromHeader: string,
    @Body() body: EventLog | TransactionReceipt,
  ) {
    this.logger.log(this.webhook.name, JSON.stringify({ authorization, body }));
    if (!signatureFromHeader || !timestampFromHeader) {
      throw new Error('Missing signature or timestamp header');
    }
    if (
      !isValidSignature(
        JSON.stringify(body),
        timestampFromHeader,
        signatureFromHeader,
        authorization.slice(7),
      )
    ) {
      throw new Error('Invalid signature');
    }

    if (isExpired(timestampFromHeader, 300)) {
      throw new Error('Request has expired');
    }

    if (body.type === 'event-log') {
      const getNeynarUserName = async (address: string) => {
        const account = (await this.neynarService.getUserInfo(address))[0];
        return account ? `@${account.username}` : '???';
      };
      switch (body.data.eventName) {
        case 'GameMade': {
          this.logger.log('GameMade');
          const { maker, signature, gameId } = body.data
            .decodedLog as GameMadeEvent;
          // gameIdとsignatureを紐づける
          // gameIdを元にゲームの情報を取得してBotからCast
          let botMessageText = '';
          botMessageText += `${await getNeynarUserName(maker.value)} created a new game!`;
          const frameURL = `${FRAME_BASE_URL}/war/challenge/${gameId.value}`;
          const res = await this.neynarService.publishCast(botMessageText, {
            embeds: [{ url: frameURL }],
          });

          await this.neynarService.lookupCast(res.hash);

          await this.warService.onGameMade(
            gameId.value,
            signature.value,
            res.hash,
          );
          break;
        }
        case 'GameChallenged': {
          this.logger.log('GameChallenged');
          const { challenger, gameId } = body.data
            .decodedLog as GameChallengedEvent;
          const game = await this.warService.getWarGameByGameId(gameId.value);
          await this.warService.onGameChallenged(
            gameId.value,
            challenger.value,
          );
          // revealトランザクションをEngine経由で実行
          // bytes8 gameId,
          // uint256 makerCard,
          // uint256 nonce
          await sendTransaction(WAR_CONTRACT_ADDRESS, 'revealCard', [
            gameId.value,
            game.maker_token_id,
            game.seed,
          ]);
          const botMessageText = `${await getNeynarUserName(challenger.value)} challenged!`;
          const res = await this.neynarService.publishCast(botMessageText, {
            replyTo: game.cast_hash_made,
          });
          await this.neynarService.lookupCast(res.hash);
          await this.warService.onGameChallengedCasted(gameId.value, res.hash);
          break;
        }
        case 'GameRevealed': {
          this.logger.log('GameRevealed');
          // ゲーム結果を取得
          const { gameId, maker, challenger, winner } = body.data
            .decodedLog as GameRevealedEvent;
          let botMessageText = '';
          if (winner.value === zeroAddress) {
            // 引き分けの場合
            // イベントのwinnerがzeroAddressかつ、makerとchallenger両方がzeroAddressでないもの
            botMessageText += `${await getNeynarUserName(maker.value)} ${await getNeynarUserName(challenger.value)}`;
            botMessageText += '\n';
            botMessageText += 'The game was draw.';
          } else if (
            winner.value === challenger.value ||
            winner.value === maker.value
          ) {
            if (
              winner.value === challenger.value &&
              maker.value === zeroAddress
            ) {
              // Makerが棄権の場合（賭けたカードを持ってない場合）
              // イベントのwinnerがchallengerのアドレスで、makerがzeroAddressの場合。棄権した場合イベントにはzeroAddressが入るようにしました。
              botMessageText += `${await getNeynarUserName(maker.value)}`;
              botMessageText += '\n';
              botMessageText += 'Opponent hold the game and you won!';
            } else if (
              winner.value === maker.value &&
              challenger.value === zeroAddress
            ) {
              // Challengerが棄権の場合（賭けたカードを持ってない場合）
              // イベントのwinnerがmakerのアドレスで、challengerがzeroAddressの場合。棄権した場合イベントにはzeroAddressが入るようにしました。
              botMessageText += `${await getNeynarUserName(challenger.value)}`;
              botMessageText += '\n';
              botMessageText += 'Opponent hold the game and you won!';
            } else if (winner.value === maker.value || winner.value) {
              // 勝敗が付いた場合
              botMessageText += `${await getNeynarUserName(maker.value)} ${await getNeynarUserName(challenger.value)}`;
              botMessageText += '\n';
              botMessageText += `${await getNeynarUserName(winner.value)} won the game!`;
            }
          } else {
            throw new Error('unexpected error');
          }
          // GameChallengedと同様にgameIdからcastのhashをとってきて、リプライとして投稿
          const game = await this.warService.getWarGameByGameId(gameId.value);
          const res = await this.neynarService.publishCast(botMessageText, {
            replyTo: game.cast_hash_made,
          });
          await this.neynarService.lookupCast(res.hash);
          await this.warService.onGameRevealed(gameId.value, res.hash);
          break;
        }
        default: {
          break;
        }
      }
    }
  }
}
