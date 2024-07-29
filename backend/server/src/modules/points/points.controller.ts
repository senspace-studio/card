import {
  Controller,
  Get,
  Param,
  Query,
  Logger,
  UseInterceptors,
  Inject,
} from '@nestjs/common';
import {
  CACHE_MANAGER,
  CacheInterceptor,
  CacheKey,
  CacheTTL,
} from '@nestjs/cache-manager';
import { PointsService } from './points.service';
import * as dayjs from 'dayjs';
import { Cache } from 'cache-manager';
import parser from 'cron-parser';
import {
  STACK_VARIABLES_ADDRESS,
  STREAM_SCORING_CRON_EXPRESSION,
} from 'src/utils/env';
import { readContract } from 'src/lib/thirdweb-engine/read-contract';
import { WarService } from '../war/war.service';
const cronParser: typeof parser = require('cron-parser');

@Controller('points')
export class PointsController {
  private readonly logger = new Logger(PointsController.name);
  constructor(
    private readonly pointsService: PointsService,
    private readonly warService: WarService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  // クエリパラメータでページ、ソートの指定ができるように
  // /points?orderBy=DESC&page=2 1ページあたりとりあえず20個
  @Get('/')
  async getAllPoints(
    @Query('orderBy') orderBy?: 'DESC' | 'ASC',
    @Query('page') page?: string,
  ) {
    this.logger.log(this.getAllPoints.name);

    const scores = await this.pointsService.getScores();

    return scores;
  }

  // 全アドレスの合計スコアを返却
  @Get('/total')
  async getTotalPoint() {
    this.logger.log(this.getTotalPoint.name);

    const totalScore = await this.pointsService.getTotalScore();

    return totalScore;
  }

  @Get('/calcurate-score')
  async calcurateScore(@Query('end_date_unix') endDateUnixMilli: number) {
    this.logger.log(this.calcurateScore.name);

    if (!endDateUnixMilli) {
      throw new Error('Invalid query params');
    }

    const baseDate = dayjs(Number(endDateUnixMilli));

    const totalScore = await this.pointsService.calcTotalScore(baseDate);

    return totalScore;
  }

  @Get('/execute-scoring')
  async executeScoring(@Query('end_date_unix') endDateUnixMilli: number) {
    this.logger.log('update score');
    try {
      await this.pointsService.executeScoring(
        endDateUnixMilli && Number(endDateUnixMilli),
      );
      return 'success';
    } catch (error) {
      throw new Error(error);
    }
  }

  @CacheKey('realtime_total_rewards')
  @CacheTTL(300000)
  @Get('/realtime-total-rewards')
  async getRealtimeTotalReward() {
    this.logger.log(this.getRealtimeTotalReward.name);

    const baseDate = dayjs();
    const currentCronDate = cronParser
      .parseExpression(STREAM_SCORING_CRON_EXPRESSION)
      .prev()
      .toDate();

    const numOfTodaySpentCards = await this.warService.numOfSpentCards(
      currentCronDate.getTime() / 1000,
      baseDate.subtract(10, 'seconds').unix(),
    );
    const totalRewardsAmount = numOfTodaySpentCards * 190 * 0.9;

    return { totalRewardsAmount };
  }

  @CacheKey('realtime_stackData')
  @CacheTTL(60000)
  @Get('/realtime-stack-data')
  async getRealtimeStackData() {
    this.logger.log(this.getRealtimeStackData.name);

    const baseDate = dayjs();
    const currentCronDate = cronParser
      .parseExpression(STREAM_SCORING_CRON_EXPRESSION)
      .prev()
      .toDate();
    const startDate = dayjs(currentCronDate).subtract(2, 'day');

    const numOfTodaySpentCards = await this.warService.numOfSpentCards(
      currentCronDate.getTime() / 1000,
      baseDate.subtract(10, 'seconds').unix(),
    );
    const totalRewardsAmount = numOfTodaySpentCards * 190 * 0.9;

    const stackData = await this.pointsService.calcTotalScore(
      baseDate,
      startDate,
    );

    return { stackData, totalRewardsAmount };
  }

  @Get('/set-schedule')
  async setSchedule(
    @Query('scored_data') scoredDate: number,
    @Query('start_date_flow') startDate_flow: number,
    @Query('end_date_flow') endDate_flow: number,
  ) {
    this.logger.log('set schedule');
    if (!STACK_VARIABLES_ADDRESS) {
      throw new Error('STACK_VARIABLES_ADDRESS is not set');
    }

    await this.pointsService.setSchedule(
      scoredDate,
      startDate_flow,
      endDate_flow,
    );
  }

  @Get('/:address')
  async getPointByAddress(@Param('address') address: string) {
    this.logger.log(this.getPointByAddress.name);

    const score = await this.pointsService.getScoreByAddress(address);

    return score;
  }
}
