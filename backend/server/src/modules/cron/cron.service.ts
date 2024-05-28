import { Injectable, Logger } from '@nestjs/common';
import { PointsService } from '../points/points.service';
import { ViemService } from '../viem/viem.service';
import { Interval } from '@nestjs/schedule';
import { RUN_CRON, UPDATE_SCORE_INTERVAL_MINUTES } from 'src/utils/env';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);
  constructor(
    private readonly pointsService: PointsService,
    private readonly viemService: ViemService,
  ) {}

  @Interval(UPDATE_SCORE_INTERVAL_MINUTES * 60 * 1e3)
  async updateScore() {
    if (!RUN_CRON) {
      this.logger.log('this process does not cron worker');
      return;
    }

    // ToDo: update score
  }
}
