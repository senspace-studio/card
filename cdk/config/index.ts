import * as dotenv from 'dotenv';

export function getConfig(stage: string) {
  dotenv.config({
    path: `.env.${stage}`,
  });

  return {
    serviceName: process.env.SERVICE_NAME!,
    stage: stage,
    aws: {
      region: process.env.AWS_REGION!,
      account: process.env.AWS_ACCOUNT!,
    },
    databse: {
      secret_suffix: process.env.DB_SECRET_SUFFIX!,
    },
    thirdweb: {
      engine_endpoint: process.env.THIRDWEB_ENGINE_ENDPOINT!,
      engine_access_token: process.env.THIRDWEB_ENGINE_ACCESS_TOKEN!,
      engine_wallet_address: process.env.THIRDWEB_ENGINE_WALLET_ADDRESS!,
    },
    farcaster: {
      neynar_api_key: process.env.NEYNAR_API_KEY!,
      signer_uuid: process.env.FARCASTER_SIGNER_UUID!,
    },
    blockchain: {
      chain_id: process.env.CHAIN_ID!,
      rpc_endpoint: process.env.BLOCKCHAIN_API!,
      dealer_private_key: process.env.DEALER_PRIVATE_KEY!,
      contract_addresses: {
        gasha: process.env.CONTRACT_ADDRESS_GASHA!,
        erc1155: process.env.CONTRACT_ADDRESS_ERC1155!,
        war: process.env.CONTRACT_ADDRESS_WAR!,
        invitation: process.env.CONTRACT_ADDRESS_INVITATION_NFT!,
      },
    },
    stream: {
      interval_minutes: process.env.STREAM_INTERVAL_MINUTES!,
      scoring_cron_expression: process.env.STREAM_SCORING_CRON_EXPRESSION!,
      set_schedule_cron_expression:
        process.env.STREAM_SET_SCHEDULE_CRON_EXPRESSION!,
      execute_schedule_cron_expression:
        process.env.STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION!,
      stream_end_schedule_cron_expression:
        process.env.STREAM_END_SCHEDULE_CRON_EXPRESSION!,
    },
    frontend: {
      client_url: process.env.CLIENT_URL!,
      ssh_host: process.env.SSH_HOST!,
      ssh_user: process.env.SSH_USER!,
      ssh_key: process.env.SSH_KEY!,
      ssh_port: process.env.SSH_PORT!,
      node_env: process.env.FRONTEND_NODE_ENV!,
    },
    backend: {
      url: process.env.BACKEND_URL!,
      node_env: process.env.BACKEND_NODE_ENV!,
    },
  };
}
