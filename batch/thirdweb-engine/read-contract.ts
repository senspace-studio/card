import tweClient from '.';

export const readContract = async (
  address: string,
  functionName: string,
  args: string,
) => {
  const res = await tweClient.GET('/contract/{chain}/{contractAddress}/read', {
    params: {
      path: {
        chain: 'degen-chain',
        contractAddress: address,
      },
      query: {
        functionName,
        args,
      },
    },
  });

  return res;
};
