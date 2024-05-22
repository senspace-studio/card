import { Stack, StackProps } from 'aws-cdk-lib'
import * as ec2 from 'aws-cdk-lib/aws-ec2'
import { Network } from '../construct/network'
import { Rds } from '../construct/rds'
import { Construct } from 'constructs'
import { EC2Bastion } from '../construct/ec2_bastion'
export class GashaInitStack extends Stack {
  readonly vpc: ec2.Vpc
  readonly ec2BastionSecurityGroup: ec2.SecurityGroup

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props)

    const { vpc, ec2BastionSecurityGroup } = new Network(this, 'Network')

    new EC2Bastion(this, 'EC2Bastion', {
      vpc,
      securityGroup: ec2BastionSecurityGroup,
    })

    this.vpc = vpc
    this.ec2BastionSecurityGroup = ec2BastionSecurityGroup
  }
}
