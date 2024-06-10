import { createPublicClient, createClient, getContract, http } from 'viem';
import { degen } from 'viem/chains';
import {
  GASHA_ABI,
  CARD_ABI,
  WAR_ABI,
  WAR_POOL_ABI,
  INVITATION_NFT_ABI,
} from '../constant/abi.js';
import {
  GASHA_CONTRACT_ADDRESS,
  CARD_CONTRACT_ADDRESS,
  WAR_CONTRACT_ADDRESS,
  WAR_POOL_CONTRACT_ADDRESS,
  INVITATION_NFT_CONTRACT_ADDRESS,
  THIRDWEB_RPC_URL,
} from '../constant/config.js';

const publicClient = createPublicClient({
  chain: degen,
  transport: http(),
});

export const gashaContract = getContract({
  abi: GASHA_ABI,
  address: GASHA_CONTRACT_ADDRESS,
  client: publicClient,
});

export const cardContract = getContract({
  abi: CARD_ABI,
  address: CARD_CONTRACT_ADDRESS,
  client: publicClient,
});

export const warContract = getContract({
  abi: WAR_ABI,
  address: WAR_CONTRACT_ADDRESS,
  client: publicClient,
});

export const warPoolContract = getContract({
  abi: WAR_POOL_ABI,
  address: WAR_POOL_CONTRACT_ADDRESS,
  client: publicClient,
});

export const inivtationNFTContracrt = getContract({
  abi: INVITATION_NFT_ABI,
  address: INVITATION_NFT_CONTRACT_ADDRESS,
  client: publicClient,
});
