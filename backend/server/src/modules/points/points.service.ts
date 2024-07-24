import { Injectable, Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { zeroAddress } from 'viem';
import { GameRevealedEventLog, TransferEventLog } from 'src/types/point';
import * as dayjs from 'dayjs';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import {
  INVITATION_CONTRACT_ADDRESS,
  STREAM_SCORING_CRON_EXPRESSION,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import tweClient from 'src/lib/thirdweb-engine';
import { S_VIP_ADDRESSES } from 'src/constants/Invitation';
import parser from 'cron-parser';
import { readContract } from 'src/lib/thirdweb-engine/read-contract';
import { chunk } from 'lodash';
const cronParser: typeof parser = require('cron-parser');

@Injectable()
export class PointsService {
  private readonly logger = new Logger(PointsService.name);

  constructor(
    @InjectRepository(HeatScoreEntity)
    private readonly heatscoreRepository: Repository<HeatScoreEntity>,
  ) {}

  async getScores() {
    const latestAccounts = await this.heatscoreRepository.find({
      order: {
        date: 'DESC',
      },
      take: 1,
    });

    const latestScores = await this.heatscoreRepository.find({
      where: {
        date: latestAccounts[0].date,
      },
      order: {
        score: 'DESC',
      },
      take: 20,
    });

    return latestScores;
  }

  async getScoreByAddress(address: string) {
    const latestAccounts = await this.heatscoreRepository.find({
      where: {
        address,
      },
      order: {
        date: 'DESC',
      },
      take: 1,
    });

    return latestAccounts;
  }

  async getTotalScore() {
    const latestAccounts = await this.heatscoreRepository.find({
      order: {
        date: 'DESC',
      },
      take: 1,
    });
    const latestDate = latestAccounts[0]?.date || 0;
    const latestScoreSum = await this.heatscoreRepository
      .createQueryBuilder('heat_score')
      .select('SUM(score)', 'totalScore')
      .where('date = :date', { date: latestDate })
      .getRawOne();

    return latestScoreSum;
  }

  async getGameLogs(startDateUnix: number, endDateUnix: number) {
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

    const blockRangeOfDays = await this.getBlockRangeOfDays(
      startDateUnix,
      endDateUnix,
    );

    const gameRevealedlogs = await Promise.all(
      gameData.result.map(async (r) => {
        const date = blockRangeOfDays.find(
          (b) =>
            b.startBlockNumber <= r.transaction.blockNumber &&
            b.endBlockNumber >= r.transaction.blockNumber,
        )?.date;
        return { ...r.data, date };
      }) as GameRevealedEventLog[],
    );

    return gameRevealedlogs;
  }

  async getInviteLogs(startDateUnix: number, endDateUnix: number) {
    const {
      result: { blockNumber: fromBlock_invite },
    } = await (
      await fetch(
        `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${startDateUnix}&closest=after`,
      )
    ).json();
    const {
      result: { blockNumber: toBlock_invite },
    } = await (
      await fetch(
        `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${endDateUnix}&closest=after`,
      )
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

    const blockRangeOfDays = await this.getBlockRangeOfDays(
      startDateUnix,
      endDateUnix,
    );

    const inviteLogs = await Promise.all(
      inviteData.result.map(async (r) => {
        const date = blockRangeOfDays.find(
          (b) =>
            b.startBlockNumber <= r.transaction.blockNumber &&
            b.endBlockNumber >= r.transaction.blockNumber,
        )?.date;
        return {
          ...r.data,
          tokenId: Number(r.data.tokenId.hex),
          date,
          blockNumber: r.transaction.blockNumber,
        };
      }) as TransferEventLog[],
    ).then((logs) => {
      logs = logs.filter(
        (log) => log.from !== zeroAddress && log.to !== zeroAddress,
      );

      const uniqueTransferLogs = new Map<number, TransferEventLog>();
      for (const log of logs) {
        if (
          log.from !== zeroAddress &&
          log.to !== zeroAddress &&
          !S_VIP_ADDRESSES.includes(log.to.toLowerCase()) &&
          (!uniqueTransferLogs.has(log.tokenId) ||
            log.blockNumber < uniqueTransferLogs.get(log.tokenId)?.blockNumber)
        ) {
          uniqueTransferLogs.set(log.tokenId, log);
        }
      }
      logs = Array.from(uniqueTransferLogs.values())
        .sort((a, b) => a.blockNumber - b.blockNumber)
        .filter(
          (log, index, self) =>
            index === self.findIndex((l) => l.to === log.to),
        );

      return logs;
    });

    return inviteLogs;
  }

  // 対戦スコアの算出
  async calcWarScore(baseUnixtime: number, gameLogs: GameRevealedEventLog[]) {
    const uniquePlayers = new Set<string>();
    gameLogs.forEach((eventLog) => {
      if (eventLog.maker !== zeroAddress)
        uniquePlayers.add(eventLog.maker.toLowerCase());
      if (eventLog.challenger !== zeroAddress)
        uniquePlayers.add(eventLog.challenger.toLowerCase());
    });

    const playerScores = new Map<string, number>();

    for (const player of uniquePlayers) {
      const playerEvents = gameLogs.filter(
        (eventLog) =>
          eventLog.maker.toLowerCase() === player ||
          eventLog.challenger.toLowerCase() === player,
      );

      let playerBaseScore = 0;

      const chunkedPlayerEvents = chunk(playerEvents, 10);

      for (let i = 0; i < chunkedPlayerEvents.length; i++) {
        i > 0 && (await new Promise((resolve) => setTimeout(resolve, 1000)));
        const playerEventItem = chunkedPlayerEvents[i];
        const results = await Promise.all(
          playerEventItem.map(async (eventLog) => {
            const resultMultiplier = this.resultMultiplier(
              eventLog.winner.toLowerCase(),
              player,
            );
            const roleMultiplier = this.roleMultiplier(
              eventLog.winner.toLowerCase(),
              player,
            );
            const decayMultiplier = this.decayMultiplier(
              baseUnixtime,
              eventLog.date,
            );
            const numOfCardMultiplier = await this.numOfCards(eventLog.gameId);

            return (
              resultMultiplier *
              roleMultiplier *
              decayMultiplier *
              numOfCardMultiplier
            );
          }),
        );
        playerBaseScore += results.reduce((acc, score) => acc + score, 0);
      }

      const totalMatches = playerEvents.length;
      const matchCountMultiplier = this.matchCountMultiplier(totalMatches);

      const uniqueOpponents = new Set(
        playerEvents.map((event) => {
          return event.maker.toLowerCase() === player
            ? event.challenger.toLowerCase()
            : event.maker;
        }),
      ).size;
      const diversityMultiplier = this.diversityMultiplier(uniqueOpponents);

      playerScores.set(
        player,
        playerBaseScore * matchCountMultiplier * diversityMultiplier,
      );
    }

    return playerScores;
  }

  private roleMultiplier(winner: string, player: string) {
    return winner === player ? 1.5 : 1;
  }

  private resultMultiplier(winner: string, player: string) {
    return winner === zeroAddress ? 1 : winner === player ? 3 : 0.3;
  }

  private decayMultiplier(baseUnixtime: number, date: number) {
    const daysElapsed = Math.floor((baseUnixtime - date) / 86400);
    return Math.max(0, 1 - 0.25 * (daysElapsed - 1));
  }

  async numOfCards(gameId: string) {
    const {
      data: { result },
    } = await readContract(WAR_CONTRACT_ADDRESS, 'numOfCards', gameId);
    return Number(result);
  }

  private matchCountMultiplier(totalMatches: number) {
    if (totalMatches <= 50) {
      return 1 + totalMatches / 50 / 4;
    } else {
      return Math.min(1 + (totalMatches - 35) / 50, 2);
    }
  }

  private diversityMultiplier(uniqueOpponents: number) {
    if (uniqueOpponents < 5) {
      return 1;
    } else if (uniqueOpponents <= 50) {
      return 1 + (uniqueOpponents - 5) * (4 / 45);
    } else {
      return 5;
    }
  }

  // リファラルスコアの算出

  calcReferralScore(
    baseUnixtime: number,
    inviteLogs: TransferEventLog[],
    gameLogs: GameRevealedEventLog[],
  ) {
    const maxDays = 14;
    const decayRate = 0.1;

    const uniquePlayers = new Set<string>();
    inviteLogs.forEach((eventLog) => {
      uniquePlayers.add(eventLog.from);
    });

    const playerScores = new Map<string, number>();

    for (const player of uniquePlayers) {
      const playerEvents = inviteLogs.filter(
        (eventLog) => eventLog.from.toLowerCase() === player.toLowerCase(),
      );

      const playerBaseScore = playerEvents.reduce((acc, eventLog) => {
        const invitee = eventLog.to.toLowerCase();

        if (player.toLowerCase() === invitee.toLowerCase()) {
          return acc;
        }

        const playCount = gameLogs.filter(
          (gameLog) =>
            gameLog.maker.toLowerCase() === invitee ||
            gameLog.challenger.toLowerCase() === invitee,
        ).length;

        const playCountBonus = this.referralPlayCountBonus(playCount);

        // 基準日以前にTransferされた場合は、基準日に合わせる
        const eventDate =
          eventLog.date < 1718798400 ? 1718798400 : eventLog.date;

        const decayMultiplier = this.referralDecay(
          dayjs(baseUnixtime * 1000).diff(dayjs(eventDate * 1000), 'days'),
          maxDays,
          decayRate,
        );

        return acc + playCountBonus * decayMultiplier;
      }, 0);

      playerScores.set(player.toLowerCase(), playerBaseScore);
    }

    return playerScores;
  }

  private referralDecay(
    daysElapsed: number,
    maxDays: number,
    decayRate: number,
  ) {
    if (daysElapsed > maxDays) {
      return 0;
    }
    return Math.exp(-decayRate * daysElapsed);
  }

  private referralPlayCountBonus(playCount: number) {
    if (playCount == 0) {
      return 0;
    } else if (playCount <= 20) {
      return playCount * (1 + (playCount / 20) * 0.25);
    } else {
      return (
        playCount * (1.25 + 1.75 * (1 - Math.exp(-0.1 * (playCount - 20))))
      );
    }
  }

  sumScores(scoreEntities: Map<string, number>[]) {
    const totalScore = new Map<string, number>();
    for (const scoreEntity of scoreEntities) {
      for (const [player, score] of scoreEntity) {
        totalScore.set(player, (totalScore.get(player) || 0) + score);
      }
    }

    return Array.from(totalScore.entries());
  }

  async calcTotalScore(baseDate: dayjs.Dayjs, startDate?: dayjs.Dayjs) {
    const startDate_game = startDate || baseDate.subtract(3, 'days');

    const gameRevealedlogs = await this.getGameLogs(
      startDate_game.unix(),
      baseDate.unix(),
    );

    const warScore = await this.calcWarScore(baseDate.unix(), gameRevealedlogs);

    const startDate_invite =
      baseDate.diff('2024-06-19', 'days') < 14
        ? dayjs('2024-06-14')
        : baseDate.subtract(14, 'days');

    const inviteLogs = await this.getInviteLogs(
      startDate_invite.unix(),
      baseDate.unix(),
    );

    const inviteScore = this.calcReferralScore(
      baseDate.unix(),
      inviteLogs,
      gameRevealedlogs,
    );

    const totalScore = this.sumScores([warScore, inviteScore]).filter(
      ([_, score]) => score > 0,
    );

    return totalScore;
  }

  async executeScoring(unixTimeMilli?: number) {
    const currentCronDate = cronParser
      .parseExpression(STREAM_SCORING_CRON_EXPRESSION)
      .prev()
      .toDate();
    const baseDate = dayjs(unixTimeMilli || currentCronDate);

    const totalScore = await this.calcTotalScore(baseDate);

    for (const [player, score] of totalScore) {
      this.logger.log(`SaveScore: player ${player}, score ${score}`);
      const exists = await this.heatscoreRepository.exists({
        where: {
          address: player,
          date: baseDate.toDate(),
        },
      });
      if (!exists) {
        await this.heatscoreRepository.save({
          address: player,
          score: score,
          date: baseDate.toDate(),
        });
      }
    }
  }

  private async getBlockRangeOfDays(
    startDateUnix: number,
    endDateUnix: number,
  ) {
    const dateList: number[] = [];
    // startDateUnixからendDateUnixまでの日付（YYYY/MM/DD）のユニークリストを作成取得
    for (let i = startDateUnix; i <= endDateUnix; i += 86400) {
      dateList.push(
        dayjs(i * 1000)
          .startOf('day')
          .unix(),
      );
    }
    // 各日付のブロック番号を取得
    const blockNumberByDays: {
      date: number;
      startBlockNumber: number;
      endBlockNumber;
    }[] = [];
    await Promise.all(
      dateList.map(async (date) => {
        const {
          result: { blockNumber: startBlockNumber },
        } = await (
          await fetch(
            `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${date}&closest=after`,
          )
        ).json();

        const now = Math.ceil(new Date().getTime() / 1000) - 60;
        const endOfDate = date + 86399 < now ? date + 86399 : now;
        const {
          result: { blockNumber: endBlockNumber },
        } = await (
          await fetch(
            `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${endOfDate}&closest=after`,
          )
        ).json();
        blockNumberByDays.push({ date, startBlockNumber, endBlockNumber });
      }),
    );

    return blockNumberByDays;
  }
}
