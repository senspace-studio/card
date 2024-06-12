declare module 'process' {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        NODE_ENV?: string;
        DB_DOMAIN: string;
        DB_PORT: string;
        DB_USERNAME: string;
        DB_PASSWORD: string;
        DB_NAME: string;
        NEYNER_API_KEY: string;
        BLOCKCHAIN_API: string;
        ERC1155_ADDRESS: string;
        GASHA_ADDRESS: string;
        RUN_CRON: string;
        CLIENT_URL: string;
        CHAIN_ID: string;
        UPDATE_SCORE_INTERVAL_MINUTES: string;
        THIRDWEB_ENGINE_ENDPOINT: string;
        THIRDWEB_ENGINE_ACCESS_TOKEN: string;
        WAR_CONTRACT_ADDRESS: string;
        DEALER_PRIVATE_KEY: string;
        ENGINE_WALLET_ADDRESS: string;
        ENGINE_WEBHOOK_SECRET: string;
        FARCASTER_SIGNER_UUID: string;
      }
    }
  }
}
