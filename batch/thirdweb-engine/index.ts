import createClient from 'openapi-fetch';
import type { paths } from './thirdweb-engine-schema';
import axios from 'axios';

const THIRDWEB_ENGINE_ENDPOINT = process.env.THIRDWEB_ENGINE_ENDPOINT || '';
const THIRDWEB_ENGINE_ACCESS_TOKEN = process.env.THIRDWEB_ENGINE_ACCESS_TOKEN || '';

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
