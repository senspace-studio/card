#!/usr/bin/env node
import 'source-map-support/register';
import { GashaInitStack } from '../lib/init-stack';
import * as cdk from 'aws-cdk-lib';
import { getConfig } from '../config';
import { AppStack, FrameAppStack } from '../lib/app-stack';
import { RdsStack } from '../lib/rds-stack';
import { BatchCalcLast7DaysResultStack } from '../lib/batch-stack';

const app = new cdk.App();

const stages = ['test', 'main-stg', 'main'];
const stage = app.node.tryGetContext('stage');
if (!stages.includes(stage)) {
  throw new Error(`stage must be one of ${stages.join(', ')}`);
}

const config = getConfig(stage);
const serviceName = config.serviceName;

const env = {
  account: config.aws.account,
  region: config.aws.region,
};

const { vpc, ec2BastionSecurityGroup } = new GashaInitStack(
  app,
  `GashaInitStack`,
  {
    description: 'Gasha Init Stack',
    tags: {
      service: 'Gasha',
    },
    env,
  },
);

const { appRunnerSecurityGroup, frameAppRunnerSecurityGroup } = new RdsStack(
  app,
  `${stage}${serviceName}RdsStack`,
  {
    description: `${serviceName} RDS Stack`,
    tags: {
      service: serviceName,
      environment: stage,
    },
    env,
  },
  {
    vpc,
    config,
    ec2BastionSecurityGroup,
  },
);

new AppStack(
  app,
  `${stage}${serviceName}AppStack`,
  {
    description: `${serviceName} AppRunner Stack`,
    tags: {
      service: serviceName,
      environment: stage,
    },
    env,
  },
  {
    vpc,
    config,
    appRunnerSecurityGroup,
  },
);

new FrameAppStack(
  app,
  `${stage}${serviceName}FrameAppStack`,
  {
    description: `${serviceName} Frame AppRunner Stack`,
    tags: {
      service: serviceName,
      environment: stage,
    },
    env,
  },
  {
    vpc,
    config,
    appRunnerSecurityGroup: frameAppRunnerSecurityGroup,
  },
);

new BatchCalcLast7DaysResultStack(
  app,
  `${stage}${serviceName}BatchCalcLast7DaysResultStack`,
  {
    description: `${serviceName} Batch Stack`,
    tags: {
      service: serviceName,
      environment: stage,
    },
  },
  {
    config,
  },
);
