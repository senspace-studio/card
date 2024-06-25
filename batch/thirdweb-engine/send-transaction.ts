import tweClient from '.';
const ENGINE_WALLET_ADDRESS = process.env.ENGINE_WALLET_ADDRESS || '0xD58916bcfBEf97F88DB399A5bc6f741813048025';

export const sendTransaction = async (
  address: string,
  functionName: string,
  args: any[],
) => {
  const res = await tweClient.POST(
    '/contract/{chain}/{contractAddress}/write',
    {
      params: {
        path: {
          chain: 'degen-chain',
          contractAddress: address,
        },
        header: {
          ['x-backend-wallet-address']: ENGINE_WALLET_ADDRESS,
        },
      },
      body: {
        functionName,
        args,
      },
    },
  );
  return res;
};

export const sendBackendWalletTransaction = async (
  address: string,
  data: string,
  value: string,
) => {
  const res = await tweClient.POST('/backend-wallet/{chain}/send-transaction', {
    params: {
      path: {
        chain: 'degen-chain',
      },
      header: {
        ['x-backend-wallet-address']: ENGINE_WALLET_ADDRESS,
      },
    },
    body: {
      toAddress: address,
      data,
      value,
    },
  });
  return res;
};
