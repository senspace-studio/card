import { Construct } from 'constructs'
import * as ec2 from 'aws-cdk-lib/aws-ec2'

interface EC2BastionProps {
  vpc: ec2.Vpc
  securityGroup: ec2.SecurityGroup
}

export class EC2Bastion extends Construct {
  constructor(scope: Construct, id: string, props: EC2BastionProps) {
    super(scope, id)

    new ec2.Instance(this, 'Gasha-Bastion', {
      vpc: props.vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO
      ),
      machineImage: new ec2.AmazonLinuxImage(),
      securityGroup: props.securityGroup,
      keyName: 'senspace_bastion',
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      associatePublicIpAddress: true,
    })
  }
}
