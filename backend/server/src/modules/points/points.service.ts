import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { zeroAddress } from 'viem';
import { GameRevealedEventLog, TransferEventLog } from 'src/types/point';
import * as dayjs from 'dayjs';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import {
  INVITATION_CONTRACT_ADDRESS,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import tweClient from 'src/lib/thirdweb-engine';
import { ViemService } from '../viem/viem.service';
import { S_VIP_ADDRESSES } from 'src/constants/Invitation';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(HeatScoreEntity)
    private readonly heatscoreRepository: Repository<HeatScoreEntity>,
    private readonly viemService: ViemService,
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

    const timestampByBlockNumber = {} as Record<number, number>;

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
            !S_VIP_ADDRESSES.includes(log.to.toLowerCase()) &&
            !uniqueTransferLogs.has(log.tokenId)) ||
          log.timestamp < uniqueTransferLogs.get(log.tokenId)?.timestamp
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

    return inviteLogs;
  }

  // 対戦スコアの算出
  calcWarScore(baseUnixtime: number, gameLogs: GameRevealedEventLog[]) {
    const uniquePlayers = new Set<string>();
    gameLogs.forEach((eventLog) => {
      uniquePlayers.add(eventLog.maker.toLowerCase());
      uniquePlayers.add(eventLog.challenger.toLowerCase());
    });

    const playerScores = new Map<string, number>();

    for (const player of uniquePlayers) {
      const playerEvents = gameLogs.filter(
        (eventLog) =>
          eventLog.maker.toLowerCase() === player ||
          eventLog.challenger.toLowerCase() === player,
      );

      const playerBaseScore = playerEvents.reduce((acc, eventLog) => {
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
          eventLog.timestamp,
        );

        return acc + resultMultiplier * roleMultiplier * decayMultiplier;
      }, 0);

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
    return winner === player ? 1.2 : 1;
  }

  private resultMultiplier(winner: string, player: string) {
    return winner === zeroAddress ? 1 : winner === player ? 1.5 : 0.8;
  }

  private decayMultiplier(baseUnixtime: number, timestamp: number) {
    const daysElapsed = Math.floor((baseUnixtime - timestamp) / 86400);
    return Math.max(0, 1 - 0.25 * (daysElapsed - 1));
  }

  private matchCountMultiplier(totalMatches: number) {
    if (totalMatches <= 50) {
      return 1 + totalMatches / 50;
    } else {
      return Math.min(2 + (totalMatches - 50) / 50, 3);
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
        const playCount = gameLogs.filter(
          (gameLog) =>
            gameLog.maker.toLowerCase() === invitee ||
            gameLog.challenger.toLowerCase() === invitee,
        ).length;
        const playCountBonus = this.referralPlayCountBonus(playCount);

        // 基準日以前にTransferされた場合は、基準日に合わせる
        const eventTimestamp =
          eventLog.timestamp < 1717687600 ? 1718687600 : eventLog.timestamp;
        const decayMultiplier = this.referralDecay(
          dayjs(baseUnixtime).diff(eventTimestamp, 'days'),
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
    if (playCount <= 20) {
      return 1 + (playCount / 20) * 0.25;
    } else {
      return 1.25 + 1.75 * (1 - Math.exp(-0.1 * (playCount - 20)));
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
}
