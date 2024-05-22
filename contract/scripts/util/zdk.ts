import { ZDK, ZDKChain, ZDKNetwork } from '@zoralabs/zdk'

const main = async () => {
  const zdk = new ZDK({
    endpoint: 'https://api.zora.co/graphql',
    networks: [
      {
        network: ZDKNetwork.Zora,
        chain: ZDKChain.ZoraMainnet,
      },
    ],
  })

  const c = await zdk.collection({
    address: '0xb5d00e222daad1b3030a6a1d0ce5f2edd8de7fd0',
  })

  console.log(c)
}

main()
