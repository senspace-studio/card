import { Injectable, Logger } from '@nestjs/common';
import { PointsService } from '../points/points.service';
import { ViemService } from '../viem/viem.service';
import { Cron, Interval } from '@nestjs/schedule';
import {
  ACCOUNT_FACTORY_ADDRESS,
  INVITATION_CONTRACT_ADDRESS,
  RUN_CRON,
  STREAM_BACKEND_WALLET,
  SUPER_TOKEN,
  UPDATE_SCORE_INTERVAL_MINUTES,
  VESTING_SCHEDULE_ADDRESS,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import tweClient, { tweClientPure } from 'src/lib/thirdweb-engine';
import * as dayjs from 'dayjs';
import { GameRevealedEventLog, TransferEventLog } from 'src/types/point';
import { Address, bytesToHex, parseEther, zeroAddress } from 'viem';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamSmartAccountEntity } from 'src/entities/stream_smartaccount';
import { randomBytes } from 'tweetnacl';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly pointsService: PointsService,
    private readonly viemService: ViemService,
    @InjectRepository(HeatScoreEntity)
    private readonly heatScoreRepository: Repository<HeatScoreEntity>,
    @InjectRepository(StreamSmartAccountEntity)
    private readonly streamSmartAccountRepository: Repository<StreamSmartAccountEntity>,
  ) {}

  @Cron('0 */6 * * *')
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

    // yを全員に分配したい。totalScoreのなかで割合を計算してyを分配する
    const totalScoreArray = Array.from(totalScore.entries());

    for (const [player, score] of totalScoreArray) {
      const exists = await this.heatScoreRepository.exists({
        where: {
          address: player,
          date: baseDate.startOf('day').toDate(),
        },
      });
      if (!exists) {
        await this.heatScoreRepository.save({
          address: player,
          score: score,
          date: baseDate.startOf('day').toDate(),
        });
      }
    }

    console.log('log');
  }

  @Interval(UPDATE_SCORE_INTERVAL_MINUTES * 111190 * 1000)
  async setSchedule() {
    if (!RUN_CRON) {
      return;
    }
    this.logger.log('Running set schedule');

    try {
      const baseDate = dayjs().startOf('day');

      const scores = await this.heatScoreRepository.find({
        where: { date: baseDate.toDate() },
      });

      const x = scores.reduce((sum, score) => sum + Number(score.score), 0);
      const h = 0.001;
      const k = 0.005;
      const y = Number((h * (1 - Math.exp(-k * x))).toFixed(18));

      const totalScoreArrayWithRatio = scores.map(({ address, score }) => {
        return {
          address,
          ratio: score / x,
        };
      });

      const flowRates = totalScoreArrayWithRatio.map(({ address, ratio }) => {
        return {
          address,
          amount: ((y * Number(ratio)) / (24 * 60 * 60)).toFixed(18),
        };
      });

      const startDate_flow = baseDate.add(1, 'day').startOf('day').unix();
      const endDate_flow = baseDate.add(1, 'day').endOf('day').unix();
      const smartAccountAddress = await this.createSmartAccount_SendDegenX(
        y,
        startDate_flow,
        endDate_flow,
      );
      console.log('smartAccountAddress', smartAccountAddress);

      for (const flowRate of flowRates) {
        await this.createVestingSchedule(
          smartAccountAddress,
          flowRate.address,
          Number(parseEther(flowRate.amount)),
          startDate_flow,
          endDate_flow,
        );
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  private writeContractParams(
    contractAddress: string,
    smartAccountAddress?: string,
  ) {
    return {
      path: {
        chain: 'degen-chain',
        contractAddress,
      },
      header: {
        'x-backend-wallet-address': STREAM_BACKEND_WALLET,
        ...(smartAccountAddress && {
          'x-account-address': smartAccountAddress,
        }),
      },
    };
  }

  private async createSmartAccount_SendDegenX(
    amount: number,
    startDate: number,
    endDate: number,
  ) {
    try {
      const createAccount = await tweClient.POST(
        '/contract/{chain}/{contractAddress}/account-factory/create-account',
        {
          params: this.writeContractParams(ACCOUNT_FACTORY_ADDRESS),
          body: {
            adminAddress: STREAM_BACKEND_WALLET,
            extraData: bytesToHex(randomBytes(32)),
          },
        },
      );

      if (createAccount.error) throw createAccount.error;

      while (true) {
        const { status } = await this.transactionQueueStatus(
          createAccount.data.result.queueId,
        );
        if (status === 'mined') {
          break;
        } else if (status === 'errored') {
          throw new Error('transaction failed');
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // exchange degenX
      const exchangeSuperToken = await tweClient.POST(
        '/backend-wallet/{chain}/send-transaction',
        {
          params: this.writeContractParams(SUPER_TOKEN),
          body: {
            toAddress: SUPER_TOKEN,
            data: `0x7687d19b000000000000000000000000${createAccount.data.result.deployedAddress.slice(2)}`,
            value: parseEther(amount.toString()).toString(),
          },
        },
      );

      if (exchangeSuperToken.error) throw exchangeSuperToken.error;

      // save to db
      await this.streamSmartAccountRepository.save({
        address: createAccount.data.result.deployedAddress,
        stream_start: startDate,
        stream_end: endDate,
      });

      return createAccount.data.result.deployedAddress;
    } catch (error) {
      throw error;
    }
  }

  private async createVestingSchedule(
    smartAccountAddress: string,
    receiver: string,
    flowRate: number,
    startDate: number,
    endDate: number,
  ) {
    try {
      await tweClient.POST('/contract/{chain}/{contractAddress}/write', {
        params: this.writeContractParams(
          VESTING_SCHEDULE_ADDRESS,
          smartAccountAddress,
        ),
        body: {
          functionName: 'createVestingSchedule',
          args: [
            SUPER_TOKEN,
            receiver,
            startDate,
            0,
            flowRate,
            0,
            endDate,
            '0x',
          ],
        },
      });
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async executeCliffAndFlow(receiver: string) {
    try {
      await tweClient.POST('/contract/{chain}/{contractAddress}/write', {
        params: this.writeContractParams(VESTING_SCHEDULE_ADDRESS),
        body: {
          functionName: 'executeCliffAndFlow',
          args: [SUPER_TOKEN, STREAM_BACKEND_WALLET, receiver],
        },
      });
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async executeEndVesting(receiver: string) {
    try {
      await tweClient.POST('/contract/{chain}/{contractAddress}/write', {
        params: this.writeContractParams(VESTING_SCHEDULE_ADDRESS),
        body: {
          functionName: 'executeEndVesting',
          args: [SUPER_TOKEN, STREAM_BACKEND_WALLET, receiver],
        },
      });
    } catch (error) {
      this.logger.error(error);
    }
  }

  private async transactionQueueStatus(queueId: string) {
    try {
      const { data } = await tweClientPure.get(
        `/transaction/status/${queueId}`,
      );

      return data.result;
    } catch (error) {
      this.logger.error(error);
    }
  }
}
