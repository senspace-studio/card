import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { PointsService } from './points.service';
import { NeynarService } from 'src/modules/neynar/neynar.service';
import { ViemService } from 'src/modules/viem/viem.service';
import * as dayjs from 'dayjs';

@Controller('points')
export class PointsController {
  private readonly logger = new Logger(PointsController.name);
  constructor(
    private readonly pointsService: PointsService,
    private readonly neynarService: NeynarService,
    private readonly viemService: ViemService,
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
  async calcurateScore(@Query('end_date_unix') endDateUnix: number) {
    this.logger.log(this.calcurateScore.name);

    if (!endDateUnix) {
      throw new Error('Invalid query params');
    }

    const startDateUnix = dayjs(Number(endDateUnix)).subtract(3, 'days').unix();
    const startInviteDateUnix = dayjs(Number(endDateUnix))
      .subtract(14, 'days')
      .unix();
    endDateUnix = dayjs(Number(endDateUnix)).unix();

    const gameRevealedlogs = await this.pointsService.getGameLogs(
      startDateUnix,
      endDateUnix,
    );

    const warScore = this.pointsService.calcWarScore(
      endDateUnix,
      gameRevealedlogs,
    );

    const inviteLogs = await this.pointsService.getInviteLogs(
      startInviteDateUnix,
      endDateUnix,
    );

    const inviteScore = this.pointsService.calcReferralScore(
      endDateUnix,
      inviteLogs,
      gameRevealedlogs,
    );

    const totalScore = this.pointsService
      .sumScores([warScore, inviteScore])
      .filter(([_, score]) => score > 0);

    return totalScore;
  }

  @Get('/execute-scoring')
  async executeScoring() {
    this.logger.log('update score');
    try {
      await this.pointsService.executeScoring();
      return 'success';
    } catch (error) {
      throw new Error(error);
    }
  }

  @Get('/:address')
  async getPointByAddress(@Param('address') address: string) {
    this.logger.log(this.getPointByAddress.name);

    const score = await this.pointsService.getScoreByAddress(address);

    return score;
  }
}
