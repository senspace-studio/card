import * as ecr from 'aws-cdk-lib/aws-ecr';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apprunner from 'aws-cdk-lib/aws-apprunner';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import { getConfig } from '../config';

interface AppRunnerProps {
  vpc: ec2.Vpc;
  appRunnerSecurityGroup: ec2.SecurityGroup;
  config: ReturnType<typeof getConfig>;
}

export class AppRunner extends Construct {
  constructor(scope: Construct, id: string, props: AppRunnerProps) {
    super(scope, id);

    const { vpc, appRunnerSecurityGroup } = props;

    const instanceRole = new iam.Role(
      scope,
      `${props.config.stage}-${props.config.serviceName}-AppRunner-Role`,
      {
        roleName: `${props.config.stage}-${props.config.serviceName}-AppRunner-Role`,
        assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      },
    );

    const accessRole = new iam.Role(
      scope,
      `${props.config.stage}-${props.config.serviceName}-AppRunner-AccessRole`,
      {
        roleName: `${props.config.stage}-${props.config.serviceName}-AppRunner-AccessRole`,
        assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      },
    );
    accessRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSAppRunnerServicePolicyForECRAccess',
      ),
    );

    const secretsDB = secretsmanager.Secret.fromSecretNameV2(
      scope,
      `${
        props.config.stage
      }-${props.config.serviceName.toLowerCase()}-db-secret-${
        props.config.databse.secret_suffix
      }`,
      `${
        props.config.stage
      }-${props.config.serviceName.toLowerCase()}-db-secret-${
        props.config.databse.secret_suffix
      }`,
    );

    const vpcConnector = new apprunner.CfnVpcConnector(
      scope,
      `${props.config.stage}-${props.config.serviceName}-AppRunner-VpcConnector`,
      {
        subnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        securityGroups: [appRunnerSecurityGroup.securityGroupId],
        vpcConnectorName: `${
          props.config.stage
        }-${props.config.serviceName.toLowerCase()}-apprunner-vpc-connector`,
      },
    );

    new apprunner.CfnService(
      scope,
      `${props.config.stage}-${props.config.serviceName}-AppRunner`,
      {
        sourceConfiguration: {
          authenticationConfiguration: {
            accessRoleArn: accessRole.roleArn,
          },
          autoDeploymentsEnabled: true,
          imageRepository: {
            imageRepositoryType: 'ECR',
            imageIdentifier: `${props.config.aws.account}.dkr.ecr.${
              props.config.aws.region
            }.amazonaws.com/${
              props.config.stage
            }-${props.config.serviceName.toLowerCase()}:latest`,
            imageConfiguration: {
              port: '3000',
              runtimeEnvironmentVariables: [
                {
                  name: 'DB_DOMAIN',
                  value: secretsDB
                    .secretValueFromJson('host')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_PORT',
                  value: secretsDB
                    .secretValueFromJson('port')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_USERNAME',
                  value: secretsDB
                    .secretValueFromJson('username')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_PASSWORD',
                  value: secretsDB
                    .secretValueFromJson('password')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_NAME',
                  value: secretsDB
                    .secretValueFromJson('dbname')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'BLOCKCHAIN_API',
                  value: props.config.blockchain.rpc_endpoint,
                },
                {
                  name: 'ERC1155_ADDRESS',
                  value: props.config.blockchain.contract_addresses.erc1155,
                },
                {
                  name: 'GASHA_ADDRESS',
                  value: props.config.blockchain.contract_addresses.gasha,
                },
                {
                  name: 'WAR_CONTRACT_ADDRESS',
                  value: props.config.blockchain.contract_addresses.war,
                },
                {
                  name: 'INVITATION_CONTRACT_ADDRESS',
                  value: props.config.blockchain.contract_addresses.invitation,
                },
                {
                  name: 'NEYNAR_API_KEY',
                  value: props.config.farcaster.neynar_api_key,
                },
                {
                  name: 'FARCASTER_SIGNER_UUID',
                  value: props.config.farcaster.signer_uuid,
                },
                {
                  name: 'CLIENT_URL',
                  value: props.config.frontend.client_url,
                },
                {
                  name: 'CHAIN_ID',
                  value: props.config.blockchain.chain_id,
                },
                {
                  name: 'THIRDWEB_ENGINE_ENDPOINT',
                  value: props.config.thirdweb.engine_endpoint,
                },
                {
                  name: 'THIRDWEB_ENGINE_ACCESS_TOKEN',
                  value: props.config.thirdweb.engine_access_token,
                },
                {
                  name: 'ENGINE_WALLET_ADDRESS',
                  value: props.config.thirdweb.engine_wallet_address,
                },
                {
                  name: 'STREAM_INTERVAL_MINUTES',
                  value: props.config.stream.interval_minutes,
                },
                {
                  name: 'STREAM_SCORING_CRON_EXPRESSION',
                  value: props.config.stream.scoring_cron_expression,
                },
                {
                  name: 'STREAM_SET_SCHEDULE_CRON_EXPRESSION',
                  value: props.config.stream.set_schedule_cron_expression,
                },
                {
                  name: 'STREAM_EXECUTE_SCHEDULE_CRON_EXPRESSION',
                  value: props.config.stream.execute_schedule_cron_expression,
                },
                {
                  name: 'STREAM_END_SCHEDULE_CRON_EXPRESSION',
                  value:
                    props.config.stream.stream_end_schedule_cron_expression,
                },
                {
                  name: 'NODE_ENV',
                  value: props.config.backend.node_env,
                },
              ],
            },
          },
        },
        healthCheckConfiguration: {
          path: '/',
          interval: 20,
        },
        instanceConfiguration: {
          instanceRoleArn: instanceRole.roleArn,
          cpu: props.config.stage === 'main' ? '1024' : '256',
          memory: props.config.stage === 'main' ? '2048' : '512',
        },
        networkConfiguration: {
          egressConfiguration: {
            egressType: 'VPC',
            vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
          },
        },

        serviceName: `${
          props.config.stage
        }-${props.config.serviceName.toLowerCase()}-apprunner`,
      },
    );
  }
}

export class FrameAppRunner extends Construct {
  constructor(scope: Construct, id: string, props: AppRunnerProps) {
    super(scope, id);

    const { vpc, appRunnerSecurityGroup } = props;

    const instanceRole = new iam.Role(
      scope,
      `${props.config.stage}-${props.config.serviceName}-Frame-AppRunner-Role`,
      {
        roleName: `${props.config.stage}-${props.config.serviceName}-Frame-AppRunner-Role`,
        assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      },
    );

    const accessRole = new iam.Role(
      scope,
      `${props.config.stage}-${props.config.serviceName}-Frame-AppRunner-AccessRole`,
      {
        roleName: `${props.config.stage}-${props.config.serviceName}-Frame-AppRunner-AccessRole`,
        assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      },
    );
    accessRole.addManagedPolicy(
      iam.ManagedPolicy.fromAwsManagedPolicyName(
        'service-role/AWSAppRunnerServicePolicyForECRAccess',
      ),
    );

    const vpcConnector = new apprunner.CfnVpcConnector(
      scope,
      `${props.config.stage}-${props.config.serviceName}-Frame-AppRunner-VpcConnector`,
      {
        subnets: vpc.selectSubnets({
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        }).subnetIds,
        securityGroups: [appRunnerSecurityGroup.securityGroupId],
        vpcConnectorName: `${
          props.config.stage
        }-${props.config.serviceName.toLowerCase()}-frame-apprunner-vpc-connector`,
      },
    );

    const secretsDB = secretsmanager.Secret.fromSecretNameV2(
      scope,
      `${
        props.config.stage
      }-${props.config.serviceName.toLowerCase()}-db-secret-${
        props.config.databse.secret_suffix
      }`,
      `${
        props.config.stage
      }-${props.config.serviceName.toLowerCase()}-db-secret-${
        props.config.databse.secret_suffix
      }`,
    );

    new apprunner.CfnService(
      scope,
      `${props.config.stage}-${props.config.serviceName}-Frame-AppRunner`,
      {
        sourceConfiguration: {
          authenticationConfiguration: {
            accessRoleArn: accessRole.roleArn,
          },
          autoDeploymentsEnabled: true,
          imageRepository: {
            imageRepositoryType: 'ECR',
            imageIdentifier: `${props.config.aws.account}.dkr.ecr.${
              props.config.aws.region
            }.amazonaws.com/${
              props.config.stage
            }-${props.config.serviceName.toLowerCase()}-frame:latest`,
            imageConfiguration: {
              port: '3000',
              runtimeEnvironmentVariables: [
                {
                  name: 'BASE_URL',
                  value: props.config.frontend.client_url,
                },
                {
                  name: 'GASHA_CONTRACT_ADDRESS',
                  value: props.config.blockchain.contract_addresses.gasha,
                },
                {
                  name: 'WAR_CONTRACT_ADDRESS',
                  value: props.config.blockchain.contract_addresses.war,
                },
                {
                  name: 'INVITATION_NFT_CONTRACT_ADDRESS',
                  value: props.config.blockchain.contract_addresses.invitation,
                },
                {
                  name: 'NEYNAR_API_KEY',
                  value: props.config.farcaster.neynar_api_key,
                },
                {
                  name: 'THIRDWEB_ENGINE_ENDPOINT',
                  value: props.config.thirdweb.engine_endpoint,
                },
                {
                  name: 'THIRDWEB_ENGINE_ACCESS_TOKEN',
                  value: props.config.thirdweb.engine_access_token,
                },
                {
                  name: 'BACKEDN_URL',
                  value: props.config.backend.url,
                },
                {
                  name: 'DB_HOST',
                  value: secretsDB
                    .secretValueFromJson('host')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_PORT',
                  value: secretsDB
                    .secretValueFromJson('port')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_USER',
                  value: secretsDB
                    .secretValueFromJson('username')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_PASSWORD',
                  value: secretsDB
                    .secretValueFromJson('password')
                    .unsafeUnwrap()
                    .toString(),
                },
                {
                  name: 'DB_DATABASE',
                  value: 'card_frame',
                },
                {
                  name: 'NODE_ENV',
                  value: props.config.frontend.node_env,
                },
              ],
            },
          },
        },
        healthCheckConfiguration: {
          path: '/',
          interval: 20,
        },
        instanceConfiguration: {
          instanceRoleArn: instanceRole.roleArn,
          cpu: props.config.stage === 'main' ? '1024' : '256',
          memory: props.config.stage === 'main' ? '2048' : '512',
        },
        networkConfiguration: {
          egressConfiguration: {
            egressType: 'VPC',
            vpcConnectorArn: vpcConnector.attrVpcConnectorArn,
          },
        },

        serviceName: `${
          props.config.stage
        }-${props.config.serviceName.toLowerCase()}-frame-apprunner`,
      },
    );
  }
}
