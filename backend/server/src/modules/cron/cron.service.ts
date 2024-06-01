import { Injectable, Logger } from '@nestjs/common';
import { PointsService } from '../points/points.service';
import { ViemService } from '../viem/viem.service';
import { Interval } from '@nestjs/schedule';
import {
  INVITATION_CONTRACT_ADDRESS,
  RUN_CRON,
  UPDATE_SCORE_INTERVAL_MINUTES,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import tweClient from 'src/lib/thirdweb-engine';
import * as dayjs from 'dayjs';
import { GameRevealedEventLog, TransferEventLog } from 'src/types/point';
import { parseEther, zeroAddress } from 'viem';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor(
    private readonly pointsService: PointsService,
    private readonly viemService: ViemService,
  ) {}

  @Interval(UPDATE_SCORE_INTERVAL_MINUTES * 10 * 1e3)
  async updateScore() {
    if (!RUN_CRON) {
      return;
    }

    this.logger.log('update score');
    // const baseDate = dayjs().startOf('day');
    const baseDate = dayjs();

    const startDate_game = baseDate.subtract(3, 'days').startOf('day');

    const { height: fromBlock_game } = await (
      await fetch(`https://coins.llama.fi/block/degen/${startDate_game.unix()}`)
    ).json();
    const { height: toBlock_game } = await (
      await fetch(`https://coins.llama.fi/block/degen/${baseDate.unix()}`)
    ).json();

    let { data: gameData } = (await tweClient.POST(
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
    )) as any;

    const timestampByBlockNumber = {} as Record<number, number>;

    const gameRevealedlogs = await Promise.all(
      gameData.result.map(async (r) => {
        let timestamp = timestampByBlockNumber[r.transaction.blockNumber];
        if (!timestamp) {
          timestamp = Number(
            await this.viemService.getBlockTimestampByBlockNumber(
              r.transaction.blockNumber,
            ),
          );
          timestampByBlockNumber[r.transaction.blockNumber] = timestamp;
        }
        return { ...r.data, timestamp };
      }) as GameRevealedEventLog[],
    );

    gameData = {};

    const warScore = this.pointsService.calcWarScore(
      baseDate.unix(),
      gameRevealedlogs,
    );

    const startDate_invite = baseDate.subtract(14, 'days').startOf('day');

    const { height: fromBlock_invite } = await (
      await fetch(
        `https://coins.llama.fi/block/degen/${startDate_invite.unix()}`,
      )
    ).json();
    const { height: toBlock_invite } = await (
      await fetch(`https://coins.llama.fi/block/degen/${baseDate.unix()}`)
    ).json();

    let { data: inviteData } = (await tweClient.POST(
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
          fromBlock: fromBlock_invite,
          toBlock: toBlock_invite,
        } as never,
      },
    )) as any;

    const inviteLogs = await Promise.all(
      inviteData.result.map(async (r) => {
        let timestamp = timestampByBlockNumber[r.transaction.blockNumber];
        if (!timestamp) {
          timestamp = Number(
            await this.viemService.getBlockTimestampByBlockNumber(
              r.transaction.blockNumber,
            ),
          );
          timestampByBlockNumber[r.transaction.blockNumber] = timestamp;
        }
        return { ...r.data, tokenId: Number(r.data.tokenId.hex), timestamp };
      }) as TransferEventLog[],
    ).then((logs) => {
      logs = logs.filter(
        (log) => log.from !== zeroAddress && log.to !== zeroAddress,
      );
      const uniqueTransferLogs = new Map<number, TransferEventLog>();
      for (const log of logs) {
        if (
          (log.from !== zeroAddress &&
            log.to !== zeroAddress &&
            !uniqueTransferLogs.has(log.tokenId)) ||
          log.timestamp < uniqueTransferLogs.get(log.tokenId)!.timestamp
        ) {
          uniqueTransferLogs.set(log.tokenId, log);
        }
      }
      logs = Array.from(uniqueTransferLogs.values())
        .sort((a, b) => a.timestamp - b.timestamp)
        .filter(
          (log, index, self) =>
            index === self.findIndex((l) => l.to === log.to),
        );

      return logs;
    });

    const inviteScore = this.pointsService.calcReferralScore(
      baseDate.unix(),
      inviteLogs,
      gameRevealedlogs,
    );

    // sum two Map<string, number>
    const totalScore = new Map<string, number>();
    for (const [player, score] of warScore) {
      totalScore.set(player, (totalScore.get(player) || 0) + score);
    }
    for (const [player, score] of inviteScore) {
      totalScore.set(player, (totalScore.get(player) || 0) + score);
    }

    const x = Array.from(totalScore.values()).reduce(
      (sum, score) => sum + score,
      0,
    );
    const h = 0.001;
    const k = 0.005;
    const y = h * (1 - Math.exp(-k * x));

    // yを全員に分配したい。totalScoreのなかで割合を計算してyを分配する
    const totalScoreArray = Array.from(totalScore.entries());
    const totalScoreSum = totalScoreArray.reduce(
      (sum, [, score]) => sum + score,
      0,
    );
    const totalScoreArrayWithRatio = totalScoreArray.map(([player, score]) => [
      player,
      score / totalScoreSum,
    ]);
    const distributedScore = totalScoreArrayWithRatio.map(
      ([player, ratio]) => [player, y * Number(ratio)] as [string, number],
    );

    for (const [player, score] of distributedScore) {
      console.log(player, score);
      // await this.viemService.createFlow(
      //   '0xda58fa9bfc3d3960df33ddd8d4d762cf8fa6f7ad',
      //   player as `0x${string}`,
      //   score,
      // );
      // await this.viemService.deleteFlow(
      //   '0xda58fa9bfc3d3960df33ddd8d4d762cf8fa6f7ad',
      //   player as `0x${string}`,
      // );
    }

    console.log('log');

    // const flowrate = await this.viemService.createFlow(
    //   '0xda58fa9bfc3d3960df33ddd8d4d762cf8fa6f7ad',
    //   zeroAddress,
    //   0,
    // );
  }
}
