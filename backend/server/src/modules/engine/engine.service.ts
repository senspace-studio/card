import { Injectable } from '@nestjs/common';
// import tweClient from 'src/lib/thirdweb-engine';
// import { ENGINE_WALLET_ADDRESS } from 'src/utils/env';

@Injectable()
export class EngineService {
  // async sendTransaction(address: string, data: string, value: string) {
  //   const res = await tweClient.POST(
  //     '/backend-wallet/{chain}/send-transaction',
  //     {
  //       params: {
  //         path: {
  //           chain: 'degen-chain',
  //         },
  //         header: {
  //           ['x-backend-wallet-address']: ENGINE_WALLET_ADDRESS,
  //         },
  //       },
  //       body: {
  //         toAddress: address,
  //         data,
  //         value,
  //       },
  //     },
  //   );
  //   return res;
  // }
}
