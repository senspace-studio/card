import { createPublicClient, getContract, http } from 'viem';
import { degen } from 'viem/chains';
import { GASHA_ABI } from '../constant/abi.js';
import { GASHA_CONTRACT_ADDRESS } from '../constant/config.js';

const publicClient = createPublicClient({
  chain: degen,
  transport: http(),
});

export const gashaContract = getContract({
  abi: GASHA_ABI,
  address: GASHA_CONTRACT_ADDRESS,
  client: publicClient,
});
