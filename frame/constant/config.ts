import dotenv from 'dotenv';

dotenv.config();

export const BASE_URL = process.env.BASE_URL as string;

export const GASHA_CONTRACT_ADDRESS = process.env
  .GASHA_CONTRACT_ADDRESS as `0x${string}`;

export const GASHA_UNIT_PRICE = 0;

export const THIRDWEB_ENGINE_ENDPOINT =
  'https://ctc3xkepem.ap-northeast-1.awsapprunner.com';
export const THIRDWEB_ENGINE_ACCESS_TOKEN =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIweDIxMjAwQThBZUYwN2YwQTc0OTJENjY5NzFiNTdBRjQ5MDM2YTI5QTAiLCJzdWIiOiIweGRDYjkzMDkzNDI0NDQ3YkY0RkU5RGY4Njk3NTA5NTA5MjJGMUUzMEIiLCJhdWQiOiJ0aGlyZHdlYi5jb20iLCJleHAiOjQ4NzA0Nzc1MzEsIm5iZiI6MTcxNjg3NzUzMSwiaWF0IjoxNzE2ODc3NTMxLCJqdGkiOiI0YjdhNTZjOC0zMTQ2LTQ3OGMtOTc1Yy0yZmNlYmRkNmMwOGYiLCJjdHgiOnsicGVybWlzc2lvbnMiOiJBRE1JTiJ9fQ.MHhlYzdmZmUyN2EyYTgyNTdjOTdlZDMwODllMjQ3NThlOTllNDAxZWNiZTY4YzkzMTZmODYwMzExN2IyYzA0MmFkNDU4ZjE4YTA4MWE0MDkzZTBmZjcwYjY2ZDgwYzI3YTkwYThjODM2MmNmYjUxNzMwMzM1Y2QxMmJjOWMxNTk4MzFj';

export const THIRDWEB_RPC_URL = 'https://666666666.rpc.thirdweb.com';

export const CARD_CONTRACT_ADDRESS =
  (process.env.CARD_CONTRACT_ADDRESS as `0x${string}`) || '0x';

export const WAR_CONTRACT_ADDRESS = process.env
  .WAR_CONTRACT_ADDRESS as `0x${string}`;

export const WAR_POOL_CONTRACT_ADDRESS = process.env
  .WAR_POOL_CONTRACT_ADDRESS as `0x${string}`;

export const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY as string;
