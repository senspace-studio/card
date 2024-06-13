import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { getConfig } from '../config';

interface SecurityGroupProps {
  vpc: ec2.Vpc;
  config: ReturnType<typeof getConfig>;
  ec2BastionSecurityGroup: ec2.SecurityGroup;
}

export class SecurityGroup extends Construct {
  readonly appRunnerSecurityGroup: ec2.SecurityGroup;
  readonly dbSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityGroupProps) {
    super(scope, id);

    this.dbSecurityGroup = new ec2.SecurityGroup(
      scope,
      `${props.config.stage}-${props.config.serviceName}-DB-SG`,
      {
        allowAllOutbound: true,
        securityGroupName: `${props.config.stage}-${props.config.serviceName}-DB-SG`,
        vpc: props.vpc,
      },
    );

    this.dbSecurityGroup.addIngressRule(
      props.ec2BastionSecurityGroup,
      ec2.Port.tcp(3306),
      'Allow Bastion to access the database',
    );

    this.appRunnerSecurityGroup = new ec2.SecurityGroup(
      scope,
      `${props.config.stage}-${props.config.serviceName}-AppRunner-SG`,
      {
        allowAllOutbound: true,
        securityGroupName: `${props.config.stage}-${props.config.serviceName}-AppRunner-SG`,
        vpc: props.vpc,
      },
    );

    this.dbSecurityGroup.addIngressRule(
      this.appRunnerSecurityGroup!,
      ec2.Port.tcp(3306),
      'Allow AppRunner to access the database',
    );
  }
}
