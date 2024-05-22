import { ethers } from 'hardhat'
import {
  addPermission,
  callSaleForMerkleMinter,
  createZoraCreator1155,
  deployZoraCreatorERC1155Factory,
  generateMerkleTree,
} from '../helper/zora'
import { deployGashaContract, setMinterArguments } from '../helper/gasha'
import { zeroAddress } from 'viem'
import MerkleTree from 'merkletreejs'

const main = async () => {
  const adminAddress = '0x807C69F16456F92ab2bFc9De8f14AF31051f9678'
  const fundRecipientAddress = '0x807C69F16456F92ab2bFc9De8f14AF31051f9678'

  const contracts = await deployZoraCreatorERC1155Factory(adminAddress)

  const zoraCreator1155Factory = await ethers.getContractAt(
    'ZoraCreator1155FactoryImpl',
    await contracts.zoraCreatorERC1155Factory.getAddress()
  )

  const zoraCreator1155Address = await createZoraCreator1155(
    zoraCreator1155Factory,
    '0x807C69F16456F92ab2bFc9De8f14AF31051f9678',
    '0x807C69F16456F92ab2bFc9De8f14AF31051f9678',
    'ipfs://QmWdGS5HgfGjbXX851xzCd2f5WFnNxK4NjpmDnUCiY8EXz'
  )

  const ZoraCreator1155 = await ethers.getContractAt(
    'ZoraCreator1155Impl',
    zoraCreator1155Address!
  )

  const gashaContract = await deployGashaContract(
    adminAddress,
    zoraCreator1155Address!,
    await contracts.merkelMinter.getAddress(),
    fundRecipientAddress,
    0.000777
  )

  for (const tokenId of [1, 2, 3]) {
    let tx = await ZoraCreator1155.setupNewTokenWithCreateReferral(
      `ipfs://QmQM3UFhUVocoKgVrdvXf1UxtYyGVnNnnrZYkePknv6R63/${tokenId}.json`,
      100000,
      fundRecipientAddress
    )
    await tx.wait()
    await addPermission(
      ZoraCreator1155,
      tokenId,
      await contracts.merkelMinter.getAddress()
    )
  }

  const leaves: [string, number, number][] = [
    [zeroAddress, 0, 0],
    [await gashaContract.getAddress(), 10e9, 0],
  ]

  const merkleTree = generateMerkleTree(leaves)
  for (const tokenId of [1, 2, 3]) {
    await callSaleForMerkleMinter(
      ZoraCreator1155,
      await contracts.merkelMinter.getAddress(),
      fundRecipientAddress,
      tokenId,
      merkleTree
    )
  }

  await setMinterArguments(gashaContract, merkleTree)

  // Add Gasha series
  let tx = await gashaContract.setNewSeriesItem(1, 0, 800)
  await tx.wait()
  tx = await gashaContract.activateSeriesItem(1)
  await tx.wait()
  tx = await gashaContract.setNewSeriesItem(2, 1, 150)
  await tx.wait()
  tx = await gashaContract.activateSeriesItem(2)
  await tx.wait()
  tx = await gashaContract.setNewSeriesItem(3, 2, 50)
  await tx.wait()
  tx = await gashaContract.activateSeriesItem(3)
  await tx.wait()

  // Set available time
  tx = await gashaContract.setAvailableTime(0, 1893456000)
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
