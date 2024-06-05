import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountEntity } from 'src/entities/account.entity';
import { TotalEntity } from 'src/entities/total.entity';
import { zeroAddress } from 'viem';
import { GameRevealedEventLog, TransferEventLog } from 'src/types/point';
import * as dayjs from 'dayjs';

@Injectable()
export class PointsService {
  constructor(
    @InjectRepository(AccountEntity)
    private readonly accountRepository: Repository<AccountEntity>,
    @InjectRepository(TotalEntity)
    private readonly totalRepository: Repository<TotalEntity>,
  ) {}

  async getEventsByMinter(minter: string) {}

  async accountExists(address: string) {
    return await this.accountRepository.exists({ where: { address } });
  }

  async updateAccount(address: string, points: number) {
    await this.accountRepository.save({ address, points });
  }

  async switchTotalRunning(isRunning: boolean) {
    await this.totalRepository.update({ id: 0 }, { isRunning });
  }

  async updateTotal(id: number, TotalEntity: Partial<TotalEntity>) {
    await this.totalRepository.update(id, TotalEntity);
  }

  // 対戦スコアの算出

  calcWarScore(baseUnixtime: number, gameLogs: GameRevealedEventLog[]) {
    const uniquePlayers = new Set<string>();
    gameLogs.forEach((eventLog) => {
      uniquePlayers.add(eventLog.maker);
      uniquePlayers.add(eventLog.challenger);
    });

    const playerScores = new Map<string, number>();

    for (const player of uniquePlayers) {
      const playerEvents = gameLogs.filter(
        (eventLog) =>
          eventLog.maker === player || eventLog.challenger === player,
      );

      const playerBaseScore = playerEvents.reduce((acc, eventLog) => {
        const resultMultiplier = this.resultMultiplier(eventLog.winner, player);
        const roleMultiplier = this.roleMultiplier(eventLog.winner, player);
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
          return event.maker === player ? event.challenger : event.maker;
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
    return winner === zeroAddress ? 0.2 : winner === player ? 1.5 : 1;
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
        (eventLog) => eventLog.from === player,
      );

      const playerBaseScore = playerEvents.reduce((acc, eventLog) => {
        const invitee = eventLog.to;
        const playCount = gameLogs.filter(
          (gameLog) =>
            gameLog.maker === invitee || gameLog.challenger === invitee,
        ).length;
        const playCountBonus = this.referralPlayCountBonus(playCount);
        const decayMultiplier = this.referralDecay(
          dayjs(baseUnixtime).diff(eventLog.timestamp, 'days'),
          maxDays,
          decayRate,
        );

        return acc + playCountBonus * decayMultiplier;
      }, 0);

      playerScores.set(player, playerBaseScore);
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
}
