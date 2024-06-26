import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { getConfig } from '../config';
import * as iam from 'aws-cdk-lib/aws-iam';

interface AppProps {
  config: ReturnType<typeof getConfig>;
}

export class BatchStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: StackProps,
    appProps: AppProps,
  ) {
    super(scope, id, props);

    const config = appProps.config;

    const bucket = new s3.Bucket(
      this,
      `${config.stage}-${config.serviceName}`,
      {
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
        publicReadAccess: true,
      },
    );
    bucket.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['s3:GetObject'],
        resources: [`${bucket.bucketArn}/*`],
        principals: [new iam.AnyPrincipal()],
        effect: iam.Effect.ALLOW,
      }),
    );

    const envVars = {
      ENGINE_WALLET_ADDRESS: config.thirdweb.engine_wallet_address,
      THIRDWEB_ENGINE_ENDPOINT: config.thirdweb.engine_endpoint,
      THIRDWEB_ENGINE_ACCESS_TOKEN: config.thirdweb.engine_access_token,
      WAR_CONTRACT_ADDRESS: config.blockchain.contract_addresses.war,
      INVITATION_CONTRACT_ADDRESS:
        config.blockchain.contract_addresses.invitation,
      S3_BACKET_NAME: bucket.bucketName,
    };

    const calcLast7DaysResultFunction = new lambdaNodeJs.NodejsFunction(
      this,
      `${config.stage}-${config.serviceName}-calcLast7DaysResult`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: '../batch/src/calcLast7DaysResult.ts',
        depsLockFilePath: '../batch/package-lock.json',
        timeout: Duration.minutes(5),
        memorySize: 1024,
        environment: envVars,
      },
    );

    const calcInvitationBattlesFunction = new lambdaNodeJs.NodejsFunction(
      this,
      `${config.stage}-${config.serviceName}-calcInvitationBattles`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: '../batch/src/calcInvitationBattles.ts',
        depsLockFilePath: '../batch/package-lock.json',
        timeout: Duration.minutes(5),
        memorySize: 1024,
        environment: envVars,
      },
    );

    bucket.grantReadWrite(calcLast7DaysResultFunction);
    bucket.grantReadWrite(calcInvitationBattlesFunction);

    const calcLast7DaysResultRule = new events.Rule(
      this,
      `${config.stage}-${config.serviceName}-calcLast7DaysResultRule`,
      {
        schedule: events.Schedule.cron({ hour: '0', minute: '15' }),
      },
    );

    calcLast7DaysResultRule.addTarget(
      new targets.LambdaFunction(calcLast7DaysResultFunction),
    );

    const calcInvitationBattlesRule = new events.Rule(
      this,
      `${config.stage}-${config.serviceName}-calcInvitationBattlesRule`,
      {
        schedule: events.Schedule.cron({ hour: '0', minute: '30' }),
      },
    );

    calcInvitationBattlesRule.addTarget(
      new targets.LambdaFunction(calcInvitationBattlesFunction),
    );
  }
}
