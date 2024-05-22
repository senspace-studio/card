export interface Config {
  stage: string

  serviceName: string

  aws: {
    accountId: string
    region: string
  }

  clientURL: string

  dbSecretSuffix: string

  blockchainApi: string

  neynarApiKey: string

  contractAddress: {
    gasha: string
    erc1155: string
    wih: string
    forwarder: string
  }

  adminPrivateKey: string
  chainId: string

  updateScoreIntervalMinutes: string

  unitPrice: string

  wihSignSeckey: string

  syndicate: {
    projectId: string
    apiKey: string
  }
}

export function getConfig(stage: string): Config {
  return require(`./${stage}.json`)
}
