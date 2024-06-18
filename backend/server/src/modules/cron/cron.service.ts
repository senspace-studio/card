import { Injectable, Logger } from '@nestjs/common';
import { PointsService } from '../points/points.service';
import { ViemService } from '../viem/viem.service';
import { Cron } from '@nestjs/schedule';
import {
  ACCOUNT_FACTORY_ADDRESS,
  RUN_CRON,
  STREAM_BACKEND_WALLET,
  STREAM_CFAV1_ADDRESS,
  STREAM_END_SCHEDULE_CRON_EXPRESSION,
  STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION,
  STREAM_HOST_ADDRESS,
  STREAM_INTERVAL_MINUTES,
  STREAM_SCORING_CRON_EXPRESSION,
  STREAM_SET_SCHEDULE_CRON_EXPRESSION,
  SUPER_TOKEN,
  VESTING_SCHEDULE_ADDRESS,
} from 'src/utils/env';
import tweClient, { tweClientPure } from 'src/lib/thirdweb-engine';
import * as dayjs from 'dayjs';
import { bytesToHex, maxUint256, parseUnits } from 'viem';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamSmartAccountEntity } from 'src/entities/stream_smartaccount';
import { randomBytes } from 'tweetnacl';
import parser from 'cron-parser';
import { chunk } from 'lodash';
const cronParser: typeof parser = require('cron-parser');

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

  @Cron('*/10 * * * * *')
  async test() {}

  @Cron(STREAM_SCORING_CRON_EXPRESSION)
  async updateScore() {
    if (!RUN_CRON) {
      return;
    }

    this.logger.log('update score');

    const currentCronDate = cronParser
      .parseExpression(STREAM_SCORING_CRON_EXPRESSION)
      .prev()
      .toDate();
    const baseDate = dayjs(currentCronDate);

    const startDate_game = baseDate.subtract(3, 'days');

    console.log('Scoring range', startDate_game.toDate(), baseDate.toDate());

    const gameRevealedlogs = await this.pointsService.getGameLogs(
      startDate_game.unix(),
      baseDate.unix(),
    );

    const warScore = this.pointsService.calcWarScore(
      baseDate.unix(),
      gameRevealedlogs,
    );

    const startDate_invite = baseDate.subtract(14, 'days');

    const inviteLogs = await this.pointsService.getInviteLogs(
      startDate_invite.unix(),
      baseDate.unix(),
    );

    const inviteScore = this.pointsService.calcReferralScore(
      baseDate.unix(),
      inviteLogs,
      gameRevealedlogs,
    );

    const totalScore = this.pointsService.sumScores([warScore, inviteScore]);

    for (const [player, score] of totalScore) {
      const exists = await this.heatScoreRepository.exists({
        where: {
          address: player,
          date: baseDate.toDate(),
        },
      });
      if (!exists) {
        await this.heatScoreRepository.save({
          address: player,
          score: score,
          date: baseDate.toDate(),
        });
      }
    }
  }

  @Cron(STREAM_SET_SCHEDULE_CRON_EXPRESSION)
  async setSchedule() {
    if (!RUN_CRON) {
      return;
    }
    this.logger.log('Running set schedule');

    try {
      const scoredDate = cronParser
        .parseExpression(STREAM_SCORING_CRON_EXPRESSION)
        .prev()
        .toDate();
      console.log('SetSchedule target scoreDate: ', scoredDate);
      const scores = await this.heatScoreRepository.find({
        where: { date: scoredDate },
      });

      if (scores.length === 0) return;

      const x = scores.reduce((sum, score) => sum + Number(score.score), 0);
      const h = 0.001;
      const k = 0.005;
      const y = h * (1 - Math.exp(-k * x));

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

      const executeCron = cronParser.parseExpression(
        STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION,
      );
      const startDate_flow = executeCron.next().getTime() / 1000;
      const endDate_flow = executeCron.next().getTime() / 1000 - 1;
      console.log('Stream start and end:', startDate_flow, endDate_flow);
      console.log(y);
      const smartAccountAddress = await this.createSmartAccount_SendDegenX(
        (y * Number(STREAM_INTERVAL_MINUTES)).toFixed(18),
        startDate_flow,
        endDate_flow,
      );

      await this.authorizeFlowOperatorWithFullControl(smartAccountAddress);

      const flowRatesChunks = chunk(flowRates, 10);
      for (const flowRates of flowRatesChunks) {
        await Promise.all(
          flowRates.map((flowRate) =>
            this.createVestingSchedule(
              smartAccountAddress,
              flowRate.address,
              Number(parseUnits(flowRate.amount, 18)),
              startDate_flow,
              endDate_flow,
            ),
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Cron(STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION)
  async executeSchedule() {
    if (!RUN_CRON) {
      return;
    }
    this.logger.log('Running execute schedule');

    try {
      const executeCron = cronParser.parseExpression(
        STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION,
      );
      const baseDate = dayjs(executeCron.prev().toDate());

      const scoredDate = cronParser
        .parseExpression(STREAM_SCORING_CRON_EXPRESSION)
        .prev()
        .toDate();
      console.log('ExecuteSchedule target scoreDate: ', scoredDate);
      const scores = await this.heatScoreRepository.find({
        where: { date: scoredDate },
      });

      if (scores.length === 0) return;

      const stream_end = executeCron.next().getTime() / 1000 - 1;
      const stream_smartaccount =
        await this.streamSmartAccountRepository.findOne({
          where: {
            stream_start: baseDate.unix(),
            stream_end,
          },
        });

      if (!stream_smartaccount)
        throw new Error('stream_smartaccount not found');
      console.log('stream_smartaccount: ', stream_smartaccount.address);

      const scoresChunks = chunk(scores, 10);
      for (const scoresChunk of scoresChunks) {
        await Promise.all(
          scoresChunk.map((score) =>
            this.executeCliffAndFlow(
              score.address,
              stream_smartaccount.address,
            ),
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      console.log('executedScores:', scores);
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Cron(STREAM_END_SCHEDULE_CRON_EXPRESSION)
  async endSchedule() {
    if (!RUN_CRON) {
      return;
    }

    this.logger.log('Running end schedule');

    const executeCron = cronParser.parseExpression(
      STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION,
    );
    const baseDate = dayjs(executeCron.prev().toDate());

    try {
      const scoredDate = cronParser.parseExpression(
        STREAM_SCORING_CRON_EXPRESSION,
      );
      scoredDate.prev();
      const targetScoreDate = scoredDate.prev().toDate();
      console.log('EndSchedule target scoreDate: ', targetScoreDate);
      const scores = await this.heatScoreRepository.find({
        where: { date: targetScoreDate },
      });

      if (scores.length === 0) return;

      const stream_end = executeCron.next().getTime() / 1000 - 1;
      console.log('Stream start and end:', baseDate.unix(), stream_end);
      const stream_smartaccount =
        await this.streamSmartAccountRepository.findOne({
          where: {
            stream_start: baseDate.unix(),
            stream_end,
          },
        });

      if (!stream_smartaccount)
        throw new Error('stream_smartaccount not found');

      const scoresChunks = chunk(scores, 10);
      for (const scoresChunk of scoresChunks) {
        await Promise.all(
          scoresChunk.map((score) =>
            this.executeEndVesting(score.address, stream_smartaccount.address),
          ),
        );
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      this.logger.error(error);
    }
  }

  @Cron(STREAM_END_SCHEDULE_CRON_EXPRESSION)
  async withdrawFromPrevSmartAccount() {
    if (!RUN_CRON) {
      return;
    }
    this.logger.log('Running withdraw from prev smartaccount');
    const executeCron = cronParser.parseExpression(
      STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION,
    );
    executeCron.prev();
    const baseDate = executeCron.prev().getTime() / 1000;
    const endDate = executeCron.next().getTime() / 1000 - 1;

    console.log('Withdraw range:', baseDate, endDate);

    const stream_smartaccount = await this.streamSmartAccountRepository.findOne(
      {
        where: {
          stream_start: baseDate,
          stream_end: endDate,
        },
      },
    );

    console.log('WithdrawAccount: ', stream_smartaccount?.address);
    await this.withdrawAllDegenX(stream_smartaccount?.address);
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
    amount: string,
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
            value: parseUnits(amount, 18).toString(),
          },
        },
      );

      if (exchangeSuperToken.error) throw exchangeSuperToken.error;

      const approveSuperToken = await tweClient.POST(
        '/contract/{chain}/{contractAddress}/write',
        {
          params: this.writeContractParams(
            SUPER_TOKEN,
            createAccount.data.result.deployedAddress,
          ),
          body: {
            functionName: 'approve',
            args: [VESTING_SCHEDULE_ADDRESS, maxUint256.toString()],
          },
        },
      );

      if (approveSuperToken.error) throw approveSuperToken.error;

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

  private async authorizeFlowOperatorWithFullControl(
    smartAccountAddress: string,
  ) {
    try {
      const cfaV1CallData =
        this.viemService.getCallData_cfaV1_authorizeFlowOperatorWithFullControl();

      const { error } = await tweClient.POST(
        '/contract/{chain}/{contractAddress}/write',
        {
          params: this.writeContractParams(
            STREAM_HOST_ADDRESS,
            smartAccountAddress,
          ),
          body: {
            functionName: 'callAgreement',
            args: [STREAM_CFAV1_ADDRESS, cfaV1CallData, '0x'],
          },
        },
      );

      if (error) throw error;
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
      throw error;
    }
  }

  private async executeCliffAndFlow(
    receiver: string,
    smartAccountAddress: string,
  ) {
    try {
      console.log('executeCliffAndFlow', smartAccountAddress, receiver);

      const { error } = await tweClient.POST(
        '/contract/{chain}/{contractAddress}/write',
        {
          params: this.writeContractParams(
            VESTING_SCHEDULE_ADDRESS,
            smartAccountAddress,
          ),
          body: {
            functionName: 'executeCliffAndFlow',
            args: [SUPER_TOKEN, smartAccountAddress, receiver],
          },
        },
      );

      if (error) throw error;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  private async executeEndVesting(
    receiver: string,
    smartAccountAddress: string,
  ) {
    try {
      const { error } = await tweClient.POST(
        '/contract/{chain}/{contractAddress}/write',
        {
          params: this.writeContractParams(
            VESTING_SCHEDULE_ADDRESS,
            smartAccountAddress,
          ),
          body: {
            functionName: 'executeEndVesting',
            args: [SUPER_TOKEN, smartAccountAddress, receiver],
          },
        },
      );
      if (error) throw error;
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
  }

  private async withdrawAllDegenX(smartAccountAddress: string) {
    try {
      const { data } = await tweClient.GET(
        '/contract/{chain}/{contractAddress}/read',
        {
          params: {
            ...this.writeContractParams(SUPER_TOKEN, smartAccountAddress),
            query: {
              functionName: 'balanceOf',
              args: smartAccountAddress,
            },
          },
        },
      );
      if (Number(data.result) === 0) return;
      const { error } = await tweClient.POST(
        '/contract/{chain}/{contractAddress}/write',
        {
          params: this.writeContractParams(SUPER_TOKEN, smartAccountAddress),
          body: {
            functionName: 'transferFrom',
            args: [smartAccountAddress, STREAM_BACKEND_WALLET, data.result],
          },
        },
      );

      if (error) throw error;
    } catch (error) {
      this.logger.error(error);
      throw error;
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
      throw error;
    }
  }
}
