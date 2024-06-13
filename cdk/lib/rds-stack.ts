import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SecurityGroup } from '../construct/sg';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Rds } from '../construct/rds';
import { getConfig } from '../config';

interface AppProps {
  vpc: ec2.Vpc;
  config: ReturnType<typeof getConfig>;
  ec2BastionSecurityGroup: ec2.SecurityGroup;
}

export class RdsStack extends Stack {
  readonly appRunnerSecurityGroup: ec2.SecurityGroup;
  readonly frameAppRunnerSecurityGroup: ec2.SecurityGroup;

  constructor(
    scope: Construct,
    id: string,
    props: StackProps,
    appProps: AppProps,
  ) {
    super(scope, id, props);

    const { vpc, config, ec2BastionSecurityGroup } = appProps;

    const {
      appRunnerSecurityGroup,
      frameAppRunnerSecurityGroup,
      dbSecurityGroup,
    } = new SecurityGroup(this, 'SecurityGroup', {
      vpc,
      config,
      ec2BastionSecurityGroup,
    });

    new Rds(this, 'Rds', {
      vpc,
      dbSecurityGroup,
      config,
    });

    this.appRunnerSecurityGroup = appRunnerSecurityGroup;
    this.frameAppRunnerSecurityGroup = frameAppRunnerSecurityGroup;
  }
}
