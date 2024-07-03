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
  INVITATION_CONTRACT_ADDRESS,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import * as crypto from 'node:crypto';
import { Address, zeroAddress } from 'viem';
import tweClient from 'src/lib/thirdweb-engine';
import { readContract } from 'src/lib/thirdweb-engine/read-contract';

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
        return account && account.username ? `@${account.username}` : '???';
      };
      if (
        body.data.contractAddress.toLowerCase() ===
        WAR_CONTRACT_ADDRESS.toLowerCase()
      ) {
        switch (body.data.eventName) {
          case 'GameMade': {
            this.logger.log('GameMade');
            const { maker, signature, gameId } = body.data
              .decodedLog as GameMadeEvent;
            // gameIdとsignatureを紐づける
            await this.warService.onGameMade(gameId.value, signature.value);

            let botMessageText = '';

            const {
              data: { result: address },
            } = await readContract(
              WAR_CONTRACT_ADDRESS,
              'requestedChallengers',
              gameId.value,
            );

            if (address === zeroAddress) {
              botMessageText += `Nice, ${await getNeynarUserName(maker.value)}! You've created a game!\nI will let you know once you've matched with another player.\n\nCheck out the /card channel to find games to play.`;
            } else {
              botMessageText += `${await getNeynarUserName(address as string)} has challenged ${await getNeynarUserName(maker.value)} to a battle!\nComplete the battle below!`;
            }

            const frameURL = `${FRAME_BASE_URL}/war/challenge/${gameId.value}`;

            const res = await this.neynarService.publishCast(botMessageText, {
              embeds: [{ url: frameURL }],
            });

            try {
              await this.neynarService.lookupCast(res.hash);
            } catch (error) {
              this.logger.error(error);
            }

            await this.warService.onGameMadeCasted(gameId.value, res.hash);
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
            const botMessageText = `You've matched with ${await getNeynarUserName(challenger.value)}!\nGame results coming momentarily...`;
            const res = await this.neynarService.publishCast(
              botMessageText,
              game.cast_hash_made && {
                replyTo: game.cast_hash_made,
              },
            );

            await this.warService.onGameChallengedCasted(
              gameId.value,
              res.hash,
            );
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
              const { data } = await readContract(
                WAR_CONTRACT_ADDRESS,
                'games',
                gameId.value,
              );
              const card = BigInt(data.result[3]?.hex).toString(10) || '';

              botMessageText += `It’s a draw! ${await getNeynarUserName(maker.value)} and ${await getNeynarUserName(challenger.value)} both played a ${card}`;
              botMessageText += '\n';
              botMessageText +=
                'Play again or find a match in the /card channel!';
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
                botMessageText += `${await getNeynarUserName(challenger.value)}`;
                botMessageText += '\n';
                botMessageText += 'Opponent hold the game and you won!';
              } else if (
                winner.value === maker.value &&
                challenger.value === zeroAddress
              ) {
                // Challengerが棄権の場合（賭けたカードを持ってない場合）
                // イベントのwinnerがmakerのアドレスで、challengerがzeroAddressの場合。棄権した場合イベントにはzeroAddressが入るようにしました。
                botMessageText += `${await getNeynarUserName(maker.value)}`;
                botMessageText += '\n';
                botMessageText += 'Opponent hold the game and you won!';
              } else if (winner.value === maker.value || winner.value) {
                // 勝敗が付いた場合
                const { data } = await readContract(
                  WAR_CONTRACT_ADDRESS,
                  'games',
                  gameId.value,
                );

                let winnerCard = '';
                let loserCard = '';
                const winnerAddress = winner.value;
                const loserAddress =
                  winner.value === maker.value ? challenger.value : maker.value;

                if (winner.value.toLowerCase() === maker.value.toLowerCase()) {
                  winnerCard = BigInt(data.result[3]?.hex).toString(10) || '';
                  loserCard = BigInt(data.result[4]?.hex).toString(10) || '';
                } else {
                  winnerCard = BigInt(data.result[4]?.hex).toString(10) || '';
                  loserCard = BigInt(data.result[3]?.hex).toString(10) || '';
                }

                winnerCard = winnerCard === '14' ? 'Joker' : winnerCard;
                loserCard = loserCard === '14' ? 'Joker' : loserCard;

                botMessageText += `${await getNeynarUserName(winnerAddress)} has won with a ${winnerCard} vs. ${await getNeynarUserName(loserAddress)}'s ${loserCard}!`;
                botMessageText += '\n';
                botMessageText +=
                  'Play again or find a match in the /card channel!';
              }
            } else {
              throw new Error('unexpected error');
            }
            // GameChallengedと同様にgameIdからcastのhashをとってきて、リプライとして投稿
            const game = await this.warService.getWarGameByGameId(gameId.value);
            const res = await this.neynarService.publishCast(
              botMessageText,
              game.cast_hash_made && {
                replyTo: game.cast_hash_made,
                embeds: [{ url: `${FRAME_BASE_URL}/war` }],
              },
            );

            await this.warService.onGameRevealed(gameId.value, res.hash);
            break;
          }
          default: {
            break;
          }
        }
      } else if (
        body.data.contractAddress.toLowerCase() ===
        INVITATION_CONTRACT_ADDRESS.toLowerCase()
      ) {
        switch (body.data.eventName) {
          case 'Transfer': {
            const { to } = body.data.decodedLog as {
              to: ContractEventObject;
            };

            const receivedTransfersRes = await tweClient.POST(
              '/contract/{chain}/{contractAddress}/events/get',
              {
                params: {
                  path: {
                    chain: 'degen-chain',
                    contractAddress: INVITATION_CONTRACT_ADDRESS,
                  },
                },
                body: {
                  eventName: 'Transfer',
                  fromBlock: 0,
                  toBlock: 'latest',
                  order: 'desc',
                  filters: {
                    to: to.value,
                  },
                } as never,
              },
            );

            if (receivedTransfersRes.data.result.length > 1) break;

            const NEW_INVITATIONS = 2;
            await Promise.all(
              Array(NEW_INVITATIONS)
                .fill(0)
                .map(async () => {
                  sendTransaction(INVITATION_CONTRACT_ADDRESS, 'mintTo', [
                    to.value,
                    'https://azure-used-mammal-656.mypinata.cloud/ipfs/Qmay2PxCRxVxBaoLPH95Y38MLd4JKhGqJu98GCGayq3Vne',
                  ]);
                }),
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
}
