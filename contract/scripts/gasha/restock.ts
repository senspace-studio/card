import { ethers, network } from 'hardhat'
import { zeroAddress } from 'viem'
import {
  addPermission,
  callSaleForMerkleMinter,
  generateMerkleTree,
} from '../helper/zora'

const main = async () => {
  const { name } = network
  let gashaAddress = ''
  let erc1155Address = ''
  let merkleMinterAddress = ''
  let fundRecipientAddress = '0xdCb93093424447bF4FE9Df869750950922F1E30B' // for Dev
  // let fundRecipientAddress = '0xb17e447d0Eb15c444789886F2bff6A4907140bC5' // for Prod

  switch (name) {
    case 'base':
      gashaAddress = '0xcFFDfafda3873eCA81365F66d6550D63bBB46645' // For Dev
      // gashaAddress = '0x96E9215696733f7AD091A3D2437dAf892eF296C8' //For Prod
      erc1155Address = '0xF87A823a4FC78d1DdEF35E3F161a49B36202810f' // For Dev
      // erc1155Address = '0xDC4b663FF330bdDE6551b66c1F94C0Bb9584cC3d' // For Prod
      merkleMinterAddress = '0xf48172CA3B6068B20eE4917Eb27b5472f1f272C7'
      break
    case 'base_sepolia':
      gashaAddress = '0x90D7eeAd91A64aF5EcC0c45D3Dff5b3d4744208b'
      erc1155Address = '0x23116Ec383B5D73Ab368724b8c7C95e7f409eF6B'
      merkleMinterAddress = '0x3c4B815e4254C2849bC7b17900Da6D1f89B9C0f3'
      break
    default:
      break
  }

  const leaves: [string, number, number][] = [
    [zeroAddress, 0, 0],
    [gashaAddress, 10e9, 0],
  ]
  const merkleTree = generateMerkleTree(leaves)

  const gashaContract = await ethers.getContractAt('Gasha', gashaAddress)
  const ZoraCreator1155 = await ethers.getContractAt(
    'ZoraCreator1155Impl',
    erc1155Address
  )

  const ipfsBaseURI = 'ipfs://Qmd53U3s9DdwLbwhCQ1B4Pxetb3kef5A5fpS8rCVJHAcax'

  for (const tokenId of [4, 5, 6]) {
    let tx = await ZoraCreator1155.setupNewTokenWithCreateReferral(
      `${ipfsBaseURI}/${tokenId}.json`,
      10e8,
      fundRecipientAddress
    )
    await tx.wait()
    await addPermission(ZoraCreator1155, tokenId, merkleMinterAddress)
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  for (const tokenId of [4, 5, 6]) {
    await callSaleForMerkleMinter(
      ZoraCreator1155,
      merkleMinterAddress,
      fundRecipientAddress,
      tokenId,
      merkleTree
    )
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }

  // set new series item
  let tx = await gashaContract.setNewSeriesItem(4, 0, 600)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  tx = await gashaContract.setNewSeriesItem(5, 1, 300)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  tx = await gashaContract.setNewSeriesItem(6, 2, 100)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))

  // activate and deactivate
  tx = await gashaContract.activateSeriesItem(4)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  tx = await gashaContract.deactivateSeriesItem(1)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  tx = await gashaContract.activateSeriesItem(5)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  tx = await gashaContract.deactivateSeriesItem(2)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  tx = await gashaContract.activateSeriesItem(6)
  await tx.wait()
  await new Promise((resolve) => setTimeout(resolve, 2000))
  tx = await gashaContract.deactivateSeriesItem(3)
  await tx.wait()
}

main()
