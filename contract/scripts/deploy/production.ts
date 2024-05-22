import { ethers } from 'hardhat'
import {
  addPermission,
  callSaleForMerkleMinter,
  createZoraCreator1155,
  generateMerkleTree,
} from '../helper/zora'
import { deployGashaContract, setMinterArguments } from '../helper/gasha'
import { zeroAddress } from 'viem'

const main = async () => {
  const adminAddress = '0xb17e447d0Eb15c444789886F2bff6A4907140bC5'
  const fundRecipientAddress = '0xb17e447d0Eb15c444789886F2bff6A4907140bC5'
  const merkelMinterAddress = '0xf48172CA3B6068B20eE4917Eb27b5472f1f272C7'
  const ipfsBaseURI = 'ipfs://QmejLqmKQny5XJNhuKf7Q3Net1aJauu2JC8DwnL4DH65ZN'

  const ZoraERC1155FactoryAddress = '0x777777C338d93e2C7adf08D102d45CA7CC4Ed021'

  const zoraCreator1155Factory = await ethers.getContractAt(
    'ZoraCreator1155FactoryImpl',
    ZoraERC1155FactoryAddress
  )

  const zoraCreator1155Address = await createZoraCreator1155(
    zoraCreator1155Factory,
    adminAddress,
    fundRecipientAddress,
    'ipfs://QmaFzrMn8Y1aHMA9coHdH7fyLT2Jod8QEEADznpw7gfPCk'
  )

  const ZoraCreator1155 = await ethers.getContractAt(
    'ZoraCreator1155Impl',
    zoraCreator1155Address!
  )

  const gashaContract = await deployGashaContract(
    adminAddress,
    zoraCreator1155Address!,
    merkelMinterAddress,
    fundRecipientAddress,
    0.000777
  )

  for (const tokenId of [1, 2, 3]) {
    let tx = await ZoraCreator1155.setupNewTokenWithCreateReferral(
      `${ipfsBaseURI}/${tokenId}.json`,
      10e8,
      fundRecipientAddress
    )
    await tx.wait()
    await addPermission(ZoraCreator1155, tokenId, merkelMinterAddress)
  }

  const leaves: [string, number, number][] = [
    [zeroAddress, 0, 0],
    [await gashaContract.getAddress(), 10e9, 0],
  ]

  const merkleTree = generateMerkleTree(leaves)
  for (const tokenId of [1, 2, 3]) {
    await callSaleForMerkleMinter(
      ZoraCreator1155,
      merkelMinterAddress,
      fundRecipientAddress,
      tokenId,
      merkleTree
    )
  }

  await setMinterArguments(gashaContract, merkleTree)

  // Add Gasha series
  let tx = await gashaContract.setNewSeriesItem(1, 0, 600)
  await tx.wait()
  tx = await gashaContract.setNewSeriesItem(2, 1, 300)
  await tx.wait()
  tx = await gashaContract.setNewSeriesItem(3, 2, 100)
  await tx.wait()

  console.log(
    'ZoraCreator1155 deployed to:',
    await ZoraCreator1155.getAddress()
  )
  console.log('Gasha deployed to:', await gashaContract.getAddress())

  return
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
