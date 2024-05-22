import { zeroAddress } from 'viem'
import { callSaleForMerkleMinter, generateMerkleTree } from '../helper/zora'
import { ethers } from 'hardhat'

const main = async () => {
  const leaves: [string, number, number][] = [
    [zeroAddress, 0, 0],
    ['0x96E9215696733f7AD091A3D2437dAf892eF296C8', 10e9, 0],
  ]

  const merkleTree = generateMerkleTree(leaves)

  const ZoraCreator1155 = await ethers.getContractAt(
    'ZoraCreator1155Impl',
    '0xDC4b663FF330bdDE6551b66c1F94C0Bb9584cC3d'
  )

  for (const tokenId of [1, 2, 3]) {
    await callSaleForMerkleMinter(
      ZoraCreator1155,
      '0xf48172CA3B6068B20eE4917Eb27b5472f1f272C7',
      '0xb17e447d0Eb15c444789886F2bff6A4907140bC5',
      tokenId,
      merkleTree
    )
  }
}

main()
