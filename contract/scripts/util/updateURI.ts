import { ethers } from 'hardhat'

const main = async () => {
  const ZoraCreator1155 = await ethers.getContractAt(
    'ZoraCreator1155Impl',
    '0xa39e7133b1A3e6398919605294E27B4d358f4416'
  )

  for (const tokenId of [2, 3]) {
    const tx = await ZoraCreator1155.updateTokenURI(
      tokenId,
      `ipfs://QmWdGS5HgfGjbXX851xzCd2f5WFnNxK4NjpmDnUCiY8EXz/${tokenId}`
    )
  }
}

main()
