import { Stack, StackProps } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { Config } from '../config'
import { EcrRepository } from '../construct/ecr'
import * as ecr from 'aws-cdk-lib/aws-ecr'

interface RepositoryProps {
  config: Config
}

export class GashaRepositoryStack extends Stack {
  readonly repository: ecr.Repository

  constructor(
    scope: Construct,
    id: string,
    props: StackProps,
    initProps: RepositoryProps
  ) {
    super(scope, id, props)

    const { repository } = new EcrRepository(this, 'Ecr', initProps)

    this.repository = repository
  }
}
