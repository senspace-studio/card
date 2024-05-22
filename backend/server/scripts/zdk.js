/* eslint-disable @typescript-eslint/no-var-requires */
const { ZDK, ZDKChain, ZDKNetwork } = require('@zoralabs/zdk');
const { EventType } = require('@zoralabs/zdk/dist/queries/queries-sdk');
const ZORA_API_ENDPOINT = 'https://api.zora.co/graphql';
const ZORA_API_KEY = '';
// ApprovalEvent = "APPROVAL_EVENT",
// LilNounsAuctionEvent = "LIL_NOUNS_AUCTION_EVENT",
// MintEvent = "MINT_EVENT",
// NounsAuctionEvent = "NOUNS_AUCTION_EVENT",
// SaleEvent = "SALE_EVENT",
// SeaportEvent = "SEAPORT_EVENT",
// TransferEvent = "TRANSFER_EVENT",
// V1MarketEvent = "V1_MARKET_EVENT",
// V1MediaEvent = "V1_MEDIA_EVENT",
// V2AuctionEvent = "V2_AUCTION_EVENT",
// V3AskEvent = "V3_ASK_EVENT",
// V3ModuleManagerEvent = "V3_MODULE_MANAGER_EVENT",
// V3ReserveAuctionEvent = "V3_RESERVE_AUCTION_EVENT"

const main = async () => {
  const zdk = new ZDK({
    endpoint: ZORA_API_ENDPOINT,
    networks: [
      {
        network: ZDKNetwork.Zora,
        chain: 'ZORA_SEPOLIA',
      },
    ],
  });
  // https://zora.co/collect/zora:0xab04d31c54d469e935ba95d367760ef97a414449
  const res = await zdk.tokens({
    where: {
      collectionAddresses: [
        '0xd12175C64D479e9e3d09B9B29889A36C0942bD4d',
        '0x4eb681AD4316de973fDb1bCdA6FdBFA5a2Dc5FaD',
        // '0xab04d31c54d469e935ba95d367760ef97a414449',
      ],
    },
    filter: {
      // eventTypes: [EventType.MintEvent],
      // recipientAddresses?: InputMaybe<Array<Scalars['String']>>;
      // sellerAddresses?: InputMaybe<Array<Scalars['String']>>;
      // senderAddresses?: InputMaybe<Array<Scalars['String']>>;
      // timeFilter?: InputMaybe<TimeFilter>;
    },
    pagination: {
      // after: '0x1',
      limit: 2,
    },
  });
  console.dir(res);
  console.dir(res.tokens.nodes);
};
main();
