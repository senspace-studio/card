import {
  Controller,
  Post,
  Body,
  Logger,
  Param,
  BadRequestException,
  Get,
} from '@nestjs/common';
import { WIHService } from 'src/modules/wih/wih.service';
import { SyndicateService } from '../syndicate/syndicate.service';
import { NeynarService } from '../neynar/neynar.service';
import { FORWARDER_ADDRESS } from 'src/utils/env';
import { ViemService } from '../viem/viem.service';
import { Address } from 'viem';

@Controller('wih')
export class WIHController {
  private readonly logger = new Logger(WIHController.name);
  constructor(
    private readonly wihService: WIHService,
    private readonly syndicateService: SyndicateService,
    private readonly naynarService: NeynarService,
    private readonly viemService: ViemService,
  ) {}

  @Get('/numoftickets/:address')
  async getNumOfTickets(@Param('address') address: Address) {
    this.logger.log(this.getNumOfTickets.name);
    const balance = await this.viemService.balanceOfERC404NFT(address);
    return { erc721BalanceOf: Number(balance) };
  }

  @Post('/createhat')
  async createHat(@Body('trustedData') trustedData: { messageBytes: string }) {
    this.logger.log(this.createHat.name);
    const req = await this.naynarService.validateRequest(
      trustedData.messageBytes,
    );
    const address = req.action.interactor.verified_addresses.eth_addresses[0];
    const { count } = await this.wihService.getWIHCount(address);
    const hat = this.wihService.createHat(address, count);
    const hash = hat.hash.map((e) => Buffer.from(e).toString('hex'));
    return { options: hash, count };
  }

  @Post('/choosehat/:options')
  async chooseHat(
    @Body('trustedData') trustedData: { messageBytes: string },
    @Param('options') options: string,
  ) {
    this.logger.log(this.chooseHat.name);
    const req = await this.naynarService.validateRequest(
      trustedData.messageBytes,
    );
    const buttonIndex = (req.action as any).tapped_button.index;
    const address = req.action.interactor.verified_addresses.eth_addresses[0];
    const count = Number(options);
    const wihcount = await this.wihService.getWIHCount(address);
    if (count !== wihcount.count) {
      throw new BadRequestException('bad hat count');
    }
    await this.wihService.incrementWIHCount(address);
    const hat = this.wihService.createHat(address, count);
    const selection = hat.selection;
    const pubkey = Buffer.from(hat.pubkey).toString('hex');
    const signature = hat.signature.map((e) => Buffer.from(e).toString('hex'));
    const hash = hat.hash.map((e) => Buffer.from(e).toString('hex'));
    const proof = JSON.stringify({ selection, pubkey, signature, hash });
    if (hat.selected === buttonIndex) {
      await this.syndicateService.sendTransaction(
        FORWARDER_ADDRESS,
        666666666,
        'burnAndRedeemReward(address to, uint256 rewardValue, string memo)',
        { to: address, rewardValue: hat.reward.value, memo: proof },
      );
      return {
        hit: true,
        degen_amount: hat.reward.value,
      };
    } else {
      await this.syndicateService.sendTransaction(
        FORWARDER_ADDRESS,
        666666666,
        'burn(address to, string memo)',
        { to: address, memo: proof },
      );
      return {
        hit: false,
        degen_amount: 0,
      };
    }
  }
}
