import * as cdk from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { AppRunner } from '../construct/apprunner'
import { Construct } from 'constructs'
import { Config } from '../config'

interface AppProps {
  vpc: ec2.Vpc
  config: Config
  appRunnerSecurityGroup: ec2.SecurityGroup
}

export class GashaAppStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: cdk.StackProps,
    appProps: AppProps
  ) {
    super(scope, id, props)

    const { vpc, config, appRunnerSecurityGroup } = appProps

    new AppRunner(this, 'AppRunner', {
      vpc,
      appRunnerSecurityGroup,
      config,
    })
  }
}
