import { Injectable, Logger } from '@nestjs/common';
import { NeynarAPIClient, ReactionsType } from '@neynar/nodejs-sdk';
import { NEYNER_API_KEY } from 'src/utils/env';

@Injectable()
export class NeynarService {
  private readonly logger = new Logger(NeynarService.name);

  private get client() {
    return new NeynarAPIClient(NEYNER_API_KEY);
  }

  async getUserInfo(address: string) {
    this.logger.log('getUserInfo', address);
    const users = await this.client.fetchBulkUsersByEthereumAddress([address]);
    return users[0];
  }

  async validateRequest(messageBytes: string) {
    try {
      const result = await this.client.validateFrameAction(messageBytes);
      return result;
    } catch (error) {
      throw new Error('Invalid Request');
    }
  }

  async isUserFollowing(fid: number) {
    this.logger.log('isUserFollowing', fid);
    const followers = await this.client.fetchFollowersForAChannel('ball', {
      limit: 1000,
    });
    for (const follower of followers.users) {
      if (follower.fid == fid) return true;
    }
    return false;
  }

  async publishCast(sender: string, message: string) {
    this.logger.log(this.publishCast.name);
    // ToDo: メッセージを送る
    // this.client.publishCast();
  }
}
