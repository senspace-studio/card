import createClient from 'openapi-fetch';
import type { paths } from './thirdweb-engine-schema';
import { THIRDWEB_ENGINE_ENDPOINT } from 'src/utils/env';

const tweClient = createClient<paths>({
  baseUrl: THIRDWEB_ENGINE_ENDPOINT,
  headers: {
    authorization: `Bearer ${process.env.THIRDWEB_ENGINE_ACCESS_TOKEN}`,
  },
});

export default tweClient;
