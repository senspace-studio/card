import { Injectable, Logger } from '@nestjs/common';
import { PointsService } from '../points/points.service';
import { ViemService } from '../viem/viem.service';
import { Cron } from '@nestjs/schedule';
import {
  RUN_CRON,
  STREAM_BACKEND_WALLET,
  STREAM_END_SCHEDULE_CRON_EXPRESSION,
  STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION,
  STREAM_SCORING_CRON_EXPRESSION,
  STREAM_SET_SCHEDULE_CRON_EXPRESSION,
  SUPER_TOKEN,
  VESTING_SCHEDULE_ADDRESS,
} from 'src/utils/env';
import tweClient from 'src/lib/thirdweb-engine';
import * as dayjs from 'dayjs';
import { HeatScoreEntity } from 'src/entities/heatscore.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StreamSmartAccountEntity } from 'src/entities/stream_smartaccount';
import parser from 'cron-parser';
import { chunk } from 'lodash';
import { WarService } from '../war/war.service';
const cronParser: typeof parser = require('cron-parser');

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(
    private readonly pointsService: PointsService,
    @InjectRepository(HeatScoreEntity)
    private readonly heatScoreRepository: Repository<HeatScoreEntity>,
    @InjectRepository(StreamSmartAccountEntity)
    private readonly streamSmartAccountRepository: Repository<StreamSmartAccountEntity>,
  ) {}

  @Cron(STREAM_SCORING_CRON_EXPRESSION)
  async updateScore() {
    if (!RUN_CRON) {
      return;
    }

    this.logger.log('update score');

    await this.pointsService.executeScoring();
  }

  @Cron(STREAM_SET_SCHEDULE_CRON_EXPRESSION)
  async setSchedule() {
    if (!RUN_CRON) {
      return;
    }
    this.logger.log('Running set schedule');

    const scoredDate =
      cronParser
        .parseExpression(STREAM_SCORING_CRON_EXPRESSION)
        .prev()
        .getTime() / 1000;

    const executeCron = cronParser.parseExpression(
      STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION,
    );
    const startDate_flow = executeCron.next().getTime() / 1000;
    const endDate_flow = executeCron.next().getTime() / 1000 - 1;

    this.pointsService.setSchedule(scoredDate, startDate_flow, endDate_flow);
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
        await new Promise((resolve) => setTimeout(resolve, 15000));
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
        await new Promise((resolve) => setTimeout(resolve, 15000));
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

    this.logger.log('Withdraw range:', baseDate, endDate);

    const stream_smartaccount = await this.streamSmartAccountRepository.findOne(
      {
        where: {
          stream_start: baseDate,
          stream_end: endDate,
        },
      },
    );

    if (stream_smartaccount) {
      this.logger.log('WithdrawAccount: ', stream_smartaccount?.address);
      await this.withdrawAllDegenX(stream_smartaccount?.address);
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
}
