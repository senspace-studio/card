import { Controller, Get, Param, Query, Logger } from '@nestjs/common';
import { PointsService } from './points.service';
import { NeynarService } from 'src/modules/neynar/neynar.service';
import { ZoraService } from 'src/modules/zora/zora.service';
import { ViemService } from 'src/modules/viem/viem.service';
import { ADMIN_ADDRESSES } from 'src/constants/Admin';

@Controller('points')
export class PointsController {
  private readonly logger = new Logger(PointsController.name);
  constructor(
    private readonly pointsService: PointsService,
    private readonly neynarService: NeynarService,
    private readonly zoraService: ZoraService,
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

    return await this.pointsService.getEvents(
      orderBy || 'DESC',
      Number(page || 1),
      20,
      ADMIN_ADDRESSES,
    );
  }

  // 全アドレスの合計ポイントを返却
  @Get('/total')
  async getTotalPoint() {
    this.logger.log(this.getTotalPoint.name);
    const total = await this.pointsService.getTotal({
      includeOfficialNFTs: true,
    });

    return total;
  }

  @Get('/:address')
  async getPointByAddress(@Param('address') address: string) {
    this.logger.log(this.getPointByAddress.name, JSON.stringify({ address }));
    return await this.pointsService.getAccount(address);
  }

  // クエリパラメータで引いたアイテムのレア度を指定
  // 特定のレア度のアイテムが出ずにパラメータに存在しない場合もあるのでundefinedに注意
  // 累計ではなく、単発の結果を返す。
  @Get('/:address/result')
  async getResultPointByAddress(
    @Param('address') address: string,
    @Query('common') common?: string,
    @Query('rare') rare?: string,
    @Query('special') special?: string,
  ) {
    this.logger.log(
      this.getResultPointByAddress.name,
      JSON.stringify({
        address,
        common,
        rare,
        special,
      }),
    );
    address = address.toLowerCase();
    const points = await this.pointsService.calc(
      address,
      BigInt(common || 0),
      BigInt(rare || 0),
      BigInt(special || 0),
      BigInt(new Date().getTime()),
    );
    return {
      address,
      common: {
        amount: `${points.common.amount}`,
        points: `${points.common.points}`,
      },
      rare: {
        amount: `${points.rare.amount}`,
        points: `${points.rare.points}`,
      },
      special: {
        amount: `${points.special.amount}`,
        points: `${points.special.points}`,
      },
    };
  }
}
