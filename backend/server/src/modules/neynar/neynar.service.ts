import { Injectable, Logger } from '@nestjs/common';
import { NeynarAPIClient } from '@neynar/nodejs-sdk';
import { EmbeddedCast } from '@neynar/nodejs-sdk/build/neynar-api/v2';
import { NEYNER_API_KEY, FARCASTER_SIGNER_UUID } from 'src/utils/env';

@Injectable()
export class NeynarService {
  private readonly logger = new Logger(NeynarService.name);

  private get client() {
    return new NeynarAPIClient(NEYNER_API_KEY);
  }

  async getUserInfo(address: string) {
    this.logger.log('getUserInfo', address);
    try {
      const users = await this.client.fetchBulkUsersByEthereumAddress([
        address.toLowerCase(),
      ]);

      return users ? users[address.toLowerCase()] || users[0] || [] : [];
    } catch (error) {
      return [];
    }
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
  async publishCast(
    text: string,
    options?: {
      embeds?: EmbeddedCast[];
      replyTo?: string;
      channelId?: string;
      idem?: string;
      parent_author_fid?: number;
    },
  ) {
    this.logger.log(this.publishCast.name);
    return await this.client.publishCast(FARCASTER_SIGNER_UUID, text, options);
  }
}
