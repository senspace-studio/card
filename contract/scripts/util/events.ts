import { createPublicClient, http } from 'viem'
import { baseSepolia, zoraSepolia } from 'viem/chains'
import abi from '../../artifacts/contracts/zora/nft/ZoraCreator1155Impl.sol/ZoraCreator1155Impl.json'

const main = async () => {
  const client = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  })

  const events = await client.getContractEvents({
    address: '0xDD3b3b34FcB47d761B1aac2358E7703Aa8CD3b92',
    abi: abi.abi,
    fromBlock: BigInt(7373990),
    toBlock: 'latest',
  })

  console.log(events)
}

main()
