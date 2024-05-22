import {
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { OgpService } from './ogp.service';
import { Response } from 'express';
import { PointsService } from '../points/points.service';
import { ViemService } from '../viem/viem.service';
import { SpinResult } from 'src/types/point';
import { Address } from 'viem';

@Controller('ogp')
export class OgpController {
  private readonly logger = new Logger(OgpController.name);

  constructor(
    private readonly ogpService: OgpService,
    private readonly pointsService: PointsService,
    private readonly viemService: ViemService,
  ) {}

  @Get('/square.png')
  async getSquareOgp(@Query('score') score: string, @Res() res: Response) {
    this.logger.log(this.getSquareOgp.name);

    const mintResult: SpinResult = JSON.parse(score);
    const { result, totalPoint } = this.pointsService.calcHat(
      mintResult.ids,
      mintResult.quantities,
    );

    const file = await this.ogpService.generateSquareOgp(
      totalPoint,
      mintResult.minter,
      result,
    );
    res.set({ 'Content-Type': 'image/png' });
    res.send(file);
  }

  @Get('/:address/square.png')
  async getAddressSquareOgp(
    @Param() params: { address: Address },
    @Res() res: Response,
  ) {
    this.logger.log(this.getAddressSquareOgp.name);

    const { balanceOfAll, ids } = await this.viemService.balanceOfAll(
      params.address,
      14,
    );
    const { result, totalPoint } = this.pointsService.calcHat(
      ids,
      balanceOfAll,
    );

    const file = await this.ogpService.generateSquareOgp(
      totalPoint,
      params.address,
      result,
    );
    res.set({ 'Content-Type': 'image/png' });
    res.send(file);
  }

  @Get('/total-point.png')
  async getToralPoint(@Query('score') score: string, @Res() res: Response) {
    this.logger.log(this.getToralPoint.name);

    const mintResult: SpinResult = JSON.parse(score);
    const { totalPoint } = this.pointsService.calcHat(
      mintResult.ids,
      mintResult.quantities,
    );

    const file = await this.ogpService.getTotalPoint(
      mintResult.minter,
      totalPoint,
    );
    res.set({ 'Content-Type': 'image/png' });
    res.send(file);
  }

  @Get('/choose.png')
  async getChooseOgp(@Query('count') count: string, @Res() res: Response) {
    this.logger.log(this.getChooseOgp.name);

    const file = await this.ogpService.generateChooseOgp(Number(count));
    res.set({ 'Content-Type': 'image/png' });
    res.send(file);
  }

  @Post('/save-result')
  async saveResult(
    @Body('address') address: string,
    @Body('result') result: any[],
  ) {
    this.logger.log(this.saveResult.name);
    const res = await this.ogpService.saveResult(address, result);
    return res;
  }
}
