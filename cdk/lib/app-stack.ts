import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { AppRunner, FrameAppRunner } from '../construct/apprunner';
import { Construct } from 'constructs';
import { getConfig } from '../config';

interface AppProps {
  vpc: ec2.Vpc;
  config: ReturnType<typeof getConfig>;
  appRunnerSecurityGroup: ec2.SecurityGroup;
}

export class AppStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    appProps: AppProps,
  ) {
    super(scope, id, props);

    const { vpc, config, appRunnerSecurityGroup } = appProps;

    new AppRunner(this, 'AppRunner', {
      vpc,
      appRunnerSecurityGroup,
      config,
    });
  }
}

export class FrameAppStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    appProps: AppProps,
  ) {
    super(scope, id, props);

    const { vpc, config, appRunnerSecurityGroup } = appProps;

    new FrameAppRunner(this, 'FrameAppRunner', {
      vpc,
      appRunnerSecurityGroup,
      config,
    });
  }
}
