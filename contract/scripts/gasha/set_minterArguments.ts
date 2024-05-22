import MerkleTree from 'merkletreejs'
import { zeroAddress } from 'viem'
import { callSaleForMerkleMinter, generateMerkleTree } from '../helper/zora'
import { ethers } from 'hardhat'
import { setMinterArguments } from '../helper/gasha'

const main = async () => {
  const gashaContract = await ethers.getContractAt(
    'Gasha',
    '0xa55410B75578c8941a76249C18c72167459253c7'
  )

  const leaves: [string, number, number][] = [
    [zeroAddress, 0, 0],
    [await gashaContract.getAddress(), 10e9, 0],
  ]

  let merkleTree = generateMerkleTree(leaves)

  await setMinterArguments(gashaContract, merkleTree)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
