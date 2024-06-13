export const DB_DOMAIN = process.env.DB_DOMAIN || 'db';
export const DB_PORT = Number(process.env.DB_PORT) || 3306;
export const DB_USERNAME = process.env.DB_USERNAME || 'admin';
export const DB_PASSWORD = process.env.DB_PASSWORD || 'password';
export const DB_NAME = process.env.DB_NAME || '';
export const NEYNER_API_KEY =
  process.env.NEYNER_API_KEY || '25E7274A-3A98-4FC8-BAE8-125B4C6999E2';
export const BLOCKCHAIN_API =
  process.env.BLOCKCHAIN_API || 'http://localhost:8545';
export const ERC1155_ADDRESS = process.env.ERC1155_ADDRESS || '0x';
export const GASHA_ADDRESS = process.env.GASHA_ADDRESS || '';
export const RUN_CRON = process.env.RUN_CRON === 'true';
export const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3001';
export const CHAIN_ID = Number(process.env.CHAIN_ID) || 31337;
export const UPDATE_SCORE_INTERVAL_MINUTES =
  Number(process.env.UPDATE_SCORE_INTERVAL_MINUTES) || 60;
export const THIRDWEB_ENGINE_ENDPOINT =
  process.env.THIRDWEB_ENGINE_ENDPOINT || 'http://localhost:3005';
export const THIRDWEB_ENGINE_ACCESS_TOKEN =
  process.env.THIRDWEB_ENGINE_ACCESS_TOKEN || '';
export const WAR_CONTRACT_ADDRESS = process.env.WAR_CONTRACT_ADDRESS || '';
export const DEALER_PRIVATE_KEY = process.env.DEALER_PRIVATE_KEY || '';
export const ENGINE_WALLET_ADDRESS = process.env.ENGINE_WALLET_ADDRESS || '';
export const ENGINE_WEBHOOK_SECRET = process.env.ENGINE_WEBHOOK_SECRET || '';
export const FARCASTER_SIGNER_UUID = process.env.FARCASTER_SIGNER_UUID || '';
export const FARCASTER_USER_NAME =
  process.env.FARCASTER_USER_NAME || 'yuki-dev';
export const INVITATION_CONTRACT_ADDRESS =
  process.env.INVITATION_CONTRACT_ADDRESS || '';

export const FRAME_BASE_URL = process.env.FRAME_BASE_URL || '';
// Stream
export const STREAM_INTERVAL_MINUTES =
  process.env.STREAM_INTERVAL_MINUTES || 1440;
export const STREAM_SCORING_CRON_EXPRESSION =
  process.env.STREAM_SCORING_CRON_EXPRESSION || '0 1 * * *';
export const STREAM_SET_SCHEDULE_CRON_EXPRESSION =
  process.env.STREAM_SET_SCHEDULE_CRON_EXPRESSION || '0 3 * * *';
export const STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION =
  process.env.STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION || '0 0 * * *';
export const STREAM_END_SCHEDULE_CRON_EXPRESSION =
  process.env.STREAM_END_SCHEDULE_CRON_EXPRESSION || '0 23 * * *';

export const STREAM_BACKEND_WALLET =
  process.env.STREAM_BACKEND_WALLET ||
  '0xD58916bcfBEf97F88DB399A5bc6f741813048025';
export const SUPER_TOKEN =
  process.env.SUPER_TOKEN || '0xda58fa9bfc3d3960df33ddd8d4d762cf8fa6f7ad';
export const VESTING_SCHEDULE_ADDRESS =
  process.env.VESTING_SCHEDULE_ADDRESS ||
  '0xd3F12414efa8c6b8a3385B20c39cD2C026B521cf';
export const STREAM_HOST_ADDRESS =
  process.env.STREAM_HOST_ADDRESS ||
  '0xc1314EdcD7e478C831a7a24169F7dEADB2646eD2';
export const STREAM_CFAV1_ADDRESS =
  process.env.STREAM_CFAV1_ADDRESS ||
  '0x82cc052d1b17aC554a22A88D5876B56c6b51e95c';

// Thirdweb
export const ACCOUNT_FACTORY_ADDRESS =
  process.env.ACCOUNT_FACTORY_ADDRESS ||
  '0x95c7a8A25f0E5267Ae18261f433C1D9Cf2E9e9B4';
