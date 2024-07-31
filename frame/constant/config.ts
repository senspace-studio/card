import dotenv from 'dotenv';
import { parseEther } from 'viem';

dotenv.config();

export const BASE_URL = process.env.BASE_URL as string;

export const BACKEND_URL = process.env.BACKEND_URL as string;

export const GASHA_CONTRACT_ADDRESS = process.env
  .GASHA_CONTRACT_ADDRESS as `0x${string}`;

export const GASHA_UNIT_PRICE =
  process.env.NODE_ENV === 'production' ? 100 : 0.00001;

export const THIRDWEB_ENGINE_ENDPOINT = process.env
  .THIRDWEB_ENGINE_ENDPOINT as string;
export const THIRDWEB_ENGINE_ACCESS_TOKEN = process.env
  .THIRDWEB_ENGINE_ACCESS_TOKEN as string;

export const THIRDWEB_RPC_URL = 'https://666666666.rpc.thirdweb.com';

export const CARD_CONTRACT_ADDRESS =
  (process.env.CARD_CONTRACT_ADDRESS as `0x${string}`) || '0x';

export const CARD_TOURNAMENT_CONTRACT_ADDRESS =
  (process.env.CARD_TOURNAMENT_CONTRACT_ADDRESS as `0x${string}`) || '0x';

export const WAR_CONTRACT_ADDRESS = process.env
  .WAR_CONTRACT_ADDRESS as `0x${string}`;

export const WAR_TOURNAMENT_CONTRACT_ADDRESS = process.env
  .WAR_TOURNAMENT_CONTRACT_ADDRESS as `0x${string}`;

export const WAR_POOL_CONTRACT_ADDRESS = process.env
  .WAR_POOL_CONTRACT_ADDRESS as `0x${string}`;

export const WAR_POOL_TOURNAMENT_CONTRACT_ADDRESS = process.env
  .WAR_POOL_TOURNAMENT_CONTRACT_ADDRESS as `0x${string}`;

export const INVITATION_NFT_CONTRACT_ADDRESS = process.env
  .INVITATION_NFT_CONTRACT_ADDRESS as `0x${string}`;

export const TOURNAMENT_INVITATION_NFT_CONTRACT_ADDRESS = process.env
  .TOURNAMENT_INVITATION_NFT_CONTRACT_ADDRESS as `0x${string}`;

export const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY as string;

export const IS_MAINTENANCE = process.env.IS_MAINTENANCE === 'true';
