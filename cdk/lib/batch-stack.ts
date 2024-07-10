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
      STACK_VARIABLES_CONTRACT_ADDRESS:
        config.blockchain.contract_addresses.stack_variables,
      BLOCKCHAIN_API_DEGEN: config.blockchain.rpc_endpoint,
      S3_BACKET_NAME: bucket.bucketName,
      API_ENDPOINT: config.backend.url,
      IFTTT_WEBHOOK_URL: config.ifttt.webhook_url,
      NODE_ENV: 'production',
      STACK_ALGORITHM: config.backend.scoring_algorithm_id,
    };

    // 過去7日間の試合結果を計算してS3に保存するバッチ
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

    bucket.grantReadWrite(calcLast7DaysResultFunction);

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

    // 過去14日間の招待関連のデータを計算してS3に保存するバッチ
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

    bucket.grantReadWrite(calcInvitationBattlesFunction);

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

    // 当日の試合ログをS3に保存するバッチ
    const saveBattleLogsFunction = new lambdaNodeJs.NodejsFunction(
      this,
      `${config.stage}-${config.serviceName}-saveBattleLogs`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: '../batch/src/saveBattleLogs.ts',
        depsLockFilePath: '../batch/package-lock.json',
        timeout: Duration.minutes(5),
        memorySize: 1024,
        environment: envVars,
      },
    );

    bucket.grantReadWrite(saveBattleLogsFunction);

    const saveBattleLogsRule = new events.Rule(
      this,
      `${config.stage}-${config.serviceName}-saveBattleLogsRule`,
      {
        schedule: events.Schedule.cron({ hour: '4', minute: '0' }),
      },
    );

    saveBattleLogsRule.addTarget(
      new targets.LambdaFunction(saveBattleLogsFunction, {
        event: events.RuleTargetInput.fromObject({
          time: events.EventField.time,
        }),
      }),
    );

    // 当日の招待ログをS3に保存するバッチ
    const saveInvitationLogsFunction = new lambdaNodeJs.NodejsFunction(
      this,
      `${config.stage}-${config.serviceName}-saveInvitationLogs`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: '../batch/src/saveInvitationLogs.ts',
        depsLockFilePath: '../batch/package-lock.json',
        timeout: Duration.minutes(5),
        memorySize: 1024,
        environment: envVars,
      },
    );

    bucket.grantReadWrite(saveInvitationLogsFunction);

    const saveInvitationLogsRule = new events.Rule(
      this,
      `${config.stage}-${config.serviceName}-saveInvitationLogsRule`,
      {
        schedule: events.Schedule.cron({ hour: '4', minute: '5' }),
      },
    );

    saveInvitationLogsRule.addTarget(
      new targets.LambdaFunction(saveInvitationLogsFunction, {
        event: events.RuleTargetInput.fromObject({
          time: events.EventField.time,
        }),
      }),
    );

    // 当日のスタックポイントをS3に保存するバッチ
    const saveIndividualStackDataFunction = new lambdaNodeJs.NodejsFunction(
      this,
      `${config.stage}-${config.serviceName}-saveIndividualStackData`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: '../batch/src/saveIndividualStackData.ts',
        depsLockFilePath: '../batch/package-lock.json',
        timeout: Duration.minutes(5),
        memorySize: 1024,
        environment: envVars,
      },
    );

    bucket.grantReadWrite(saveIndividualStackDataFunction);

    const saveIndividualStackDataRule = new events.Rule(
      this,
      `${config.stage}-${config.serviceName}-saveIndividualStackDataRule`,
      {
        schedule: events.Schedule.cron({ hour: '4', minute: '0' }),
      },
    );

    saveIndividualStackDataRule.addTarget(
      new targets.LambdaFunction(saveIndividualStackDataFunction, {
        event: events.RuleTargetInput.fromObject({
          time: events.EventField.time,
        }),
      }),
    );

    // 当日のリワードデータをS3に保存するバッチ
    const saveRewardHistoryDataFunction = new lambdaNodeJs.NodejsFunction(
      this,
      `${config.stage}-${config.serviceName}-saveRewardHistoryData`,
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'handler',
        entry: '../batch/src/saveRewardHistoryData.ts',
        depsLockFilePath: '../batch/package-lock.json',
        timeout: Duration.minutes(5),
        memorySize: 1024,
        environment: envVars,
      },
    );

    bucket.grantReadWrite(saveRewardHistoryDataFunction);

    const saveRewardHistoryDataRule = new events.Rule(
      this,
      `${config.stage}-${config.serviceName}-saveRewardHistoryDataRule`,
      {
        schedule: events.Schedule.cron({ hour: '4', minute: '10' }),
      },
    );

    saveRewardHistoryDataRule.addTarget(
      new targets.LambdaFunction(saveRewardHistoryDataFunction, {
        event: events.RuleTargetInput.fromObject({
          time: events.EventField.time,
        }),
      }),
    );
  }
}
