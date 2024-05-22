import { Injectable, Logger } from '@nestjs/common';
import { ZDK, /** ZDKChain, */ ZDKNetwork } from '@zoralabs/zdk';
import {
  Chain,
  // EventType,
  // EventsQueryFilter,
  // EventsQueryInput,
} from '@zoralabs/zdk/dist/queries/queries-sdk';
import { ZORA_API_ENDPOINT, ZORA_API_KEY } from 'src/utils/env';

// cronで定期実行されるポイント計算を実施

// ZDK経由でミントイベントを取ってきてアドレスごとにポイントを計算してDBに保存
// ミント時刻（blocktimestamp）と各日付のベースポイントをもとに計算

@Injectable()
export class ZoraService {
  private readonly logger = new Logger(ZoraService.name);

  private get zdk() {
    return new ZDK({
      endpoint: ZORA_API_ENDPOINT,
      networks: [
        {
          network: ZDKNetwork.Zora,
          chain: 'ZORA_SEPOLIA' as Chain,
        },
      ],
      apiKey: ZORA_API_KEY,
    });
  }

  // async getMintEvents() {
  //   // const where = { collectionAddresses, tokens };
  //   // const filter = {
  //   //   bidderAddresses,
  //   //   eventTypes,
  //   //   recipientAddresses,
  //   //   sellerAddresses,
  //   //   senderAddresses,
  //   //   timeFilter,
  //   // };
  //   // const pagination = { after, limit };
  //   // const networks = { chain, network };
  //   // const sort = { direction, sortKey };
  //   const where: EventsQueryInput = {
  //     collectionAddresses: [
  //       '0xd12175C64D479e9e3d09B9B29889A36C0942bD4d',
  //       '0x4eb681AD4316de973fDb1bCdA6FdBFA5a2Dc5FaD',
  //     ],
  //   };
  //   const filter: EventsQueryFilter = {
  //     eventTypes: [EventType.MintEvent],
  //     // timeFilter: { startDate: '', endDate: '' },
  //   };
  //   // const pagination = { after, limit };
  //   // const events = [];
  //   // const hasNext = true;
  //   // while (hasNext) { }
  //   // await this.zdk.events({ where, filter, pagination, networks, sort });
  // }
}
