import dotenv from 'dotenv';

dotenv.config();

export const BASE_URL = process.env.BASE_URL as string;

export const GASHA_CONTRACT_ADDRESS = process.env
  .GASHA_CONTRACT_ADDRESS as `0x${string}`;

export const GASHA_UNIT_PRICE = 0;

export const THIRDWEB_ENGINE_ENDPOINT =
  'https://ctc3xkepem.ap-northeast-1.awsapprunner.com';
export const THIRDWEB_ENGINE_ACCESS_TOKEN =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIweDIxMjAwQThBZUYwN2YwQTc0OTJENjY5NzFiNTdBRjQ5MDM2YTI5QTAiLCJzdWIiOiIweGRDYjkzMDkzNDI0NDQ3YkY0RkU5RGY4Njk3NTA5NTA5MjJGMUUzMEIiLCJhdWQiOiJ0aGlyZHdlYi5jb20iLCJleHAiOjQ4NzEyNTQ1MDAsIm5iZiI6MTcxNzY1NDUwMCwiaWF0IjoxNzE3NjU0NTAwLCJqdGkiOiJlNTc5NGY4MS0yN2UzLTRhYzktOWQxYS1iOTNmMjUyZDc3YjQiLCJjdHgiOnsicGVybWlzc2lvbnMiOiJBRE1JTiJ9fQ.MHhkZDg4Mzc2YmU2YWEyZjhmZTFlZWI4OTA2YjMzOWU2NTRjZTVkYjU3ZmIxNzJjMTE5ZTdkZDgzNDY5MDk4YjZjNThlNjQyZTg5YmE0ZDYzMmU0MDE0YTZjMTRmZDhjNWIxYWY5MjQ0YTAzNjAwOTg5MzUzMzhlYTUyZjY1YmM4ZjFi';

export const THIRDWEB_RPC_URL = 'https://666666666.rpc.thirdweb.com';

export const CARD_CONTRACT_ADDRESS =
  (process.env.CARD_CONTRACT_ADDRESS as `0x${string}`) || '0x';

export const WAR_CONTRACT_ADDRESS = process.env
  .WAR_CONTRACT_ADDRESS as `0x${string}`;

export const WAR_POOL_CONTRACT_ADDRESS = process.env
  .WAR_POOL_CONTRACT_ADDRESS as `0x${string}`;

export const INVITATION_NFT_CONTRACT_ADDRESS = process.env
  .INVITATION_NFT_CONTRACT_ADDRESS as `0x${string}`;

export const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY as string;
