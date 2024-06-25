import createClient from 'openapi-fetch';
import type { paths } from './thirdweb-engine-schema';
// import { THIRDWEB_ENGINE_ENDPOINT } from 'src/utils/env';
import axios from 'axios';
const THIRDWEB_ENGINE_ENDPOINT = process.env.THIRDWEB_ENGINE_ENDPOINT || 'https://ctc3xkepem.ap-northeast-1.awsapprunner.com';
const THIRDWEB_ENGINE_ACCESS_TOKEN = process.env.THIRDWEB_ENGINE_ACCESS_TOKEN || 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiIweDIxMjAwQThBZUYwN2YwQTc0OTJENjY5NzFiNTdBRjQ5MDM2YTI5QTAiLCJzdWIiOiIweGRDYjkzMDkzNDI0NDQ3YkY0RkU5RGY4Njk3NTA5NTA5MjJGMUUzMEIiLCJhdWQiOiJ0aGlyZHdlYi5jb20iLCJleHAiOjQ4NzEyNTQ1MDAsIm5iZiI6MTcxNzY1NDUwMCwiaWF0IjoxNzE3NjU0NTAwLCJqdGkiOiJlNTc5NGY4MS0yN2UzLTRhYzktOWQxYS1iOTNmMjUyZDc3YjQiLCJjdHgiOnsicGVybWlzc2lvbnMiOiJBRE1JTiJ9fQ.MHhkZDg4Mzc2YmU2YWEyZjhmZTFlZWI4OTA2YjMzOWU2NTRjZTVkYjU3ZmIxNzJjMTE5ZTdkZDgzNDY5MDk4YjZjNThlNjQyZTg5YmE0ZDYzMmU0MDE0YTZjMTRmZDhjNWIxYWY5MjQ0YTAzNjAwOTg5MzUzMzhlYTUyZjY1YmM4ZjFi';

const tweClient = createClient<paths>({
  baseUrl: THIRDWEB_ENGINE_ENDPOINT,
  headers: {
    authorization: `Bearer ${THIRDWEB_ENGINE_ACCESS_TOKEN}`,
  },
});

export const tweClientPure = axios.create({
  baseURL: THIRDWEB_ENGINE_ENDPOINT,
  headers: {
    authorization: `Bearer ${THIRDWEB_ENGINE_ACCESS_TOKEN}`,
  },
});

export default tweClient;
