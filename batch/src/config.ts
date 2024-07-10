import dotenv from 'dotenv';

dotenv.config();

export const ENGINE_WALLET_ADDRESS = process.env.ENGINE_WALLET_ADDRESS || '';
export const THIRDWEB_ENGINE_ENDPOINT =
  process.env.THIRDWEB_ENGINE_ENDPOINT || '';
export const THIRDWEB_ENGINE_ACCESS_TOKEN =
  process.env.THIRDWEB_ENGINE_ACCESS_TOKEN || '';
export const WAR_CONTRACT_ADDRESS = process.env.WAR_CONTRACT_ADDRESS || '';
export const INVITATION_CONTRACT_ADDRESS =
  process.env.INVITATION_CONTRACT_ADDRESS || '';
export const STACK_VARIABLES_CONTRACT_ADDRESS =
  process.env.STACK_VARIABLES_CONTRACT_ADDRESS || '';
export const S3_BACKET_NAME = process.env.S3_BACKET_NAME || '';
export const BLOCKCHAIN_API_DEGEN = process.env.BLOCKCHAIN_API_DEGEN || '';
export const API_ENDPOINT = process.env.API_ENDPOINT || '';
export const STACK_ALGORITHM = process.env.STACK_ALGORITHM || '';
export const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
export const S3_ACCESSKEY = process.env.S3_ACCESSKEY || '';
export const S3_SECRET_ACCESSKEY = process.env.S3_SECRET_ACCESSKEY || '';
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IFTTT_WEBHOOK_URL = process.env.IFTTT_WEBHOOK_URL || '';
