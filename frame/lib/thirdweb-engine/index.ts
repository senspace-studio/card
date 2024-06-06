import createClient from 'openapi-fetch';
import { paths } from './thirdweb-engine-schema.js';
import {
  THIRDWEB_ENGINE_ACCESS_TOKEN,
  THIRDWEB_ENGINE_ENDPOINT,
} from '../../constant/config.js';

const tweClient = createClient<paths>({
  baseUrl: THIRDWEB_ENGINE_ENDPOINT,
  headers: {
    authorization: `Bearer ${THIRDWEB_ENGINE_ACCESS_TOKEN}`,
  },
});

export default tweClient;
