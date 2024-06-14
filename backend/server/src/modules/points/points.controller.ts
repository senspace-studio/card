import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { PointsService } from './points.service';
import { NeynarService } from 'src/modules/neynar/neynar.service';
import { ViemService } from 'src/modules/viem/viem.service';
import { ADMIN_ADDRESSES } from 'src/constants/Admin';

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

  @Get('/:address')
  async getPointByAddress(@Param('address') address: string) {
    this.logger.log(this.getPointByAddress.name);

    const score = await this.pointsService.getScoreByAddress(address);

    return score;
  }
}
