import { Injectable, Logger } from '@nestjs/common';
import { PointsService } from '../points/points.service';
import { ViemService } from '../viem/viem.service';
import { Interval } from '@nestjs/schedule';
import {
  RUN_CRON,
  UPDATE_SCORE_INTERVAL_MINUTES,
  WAR_CONTRACT_ADDRESS,
} from 'src/utils/env';
import tweClient from 'src/lib/thirdweb-engine';

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

    const { data } = await tweClient.POST(
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
          // Filterが効かないので調査必要
          filters: {
            gameId: '0xb701f8373853bdd2',
          },
        } as never,
      },
    );
    // ToDo: update score
  }
}
