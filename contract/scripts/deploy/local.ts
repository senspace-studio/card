import { ethers } from "hardhat"
import { deployGashaContract } from "../helper/gasha"
import { deployGashaItemContract } from "../helper/nft"
import { deployForwarderContract, deployHatContract } from "../helper/hat"
import { ContractTransactionResponse } from "ethers"

async function main() {
  const [admin] = await ethers.getSigners()
  const adminAddress = admin.address
  const operatorAddresses = [admin.address]

  const gashaItemERC1155Contract = await deployGashaItemContract(adminAddress)

  const hatContract = await deployHatContract(adminAddress)

  const gashaContract = await deployGashaContract(
    adminAddress,
    await gashaItemERC1155Contract.getAddress(),
    await hatContract.getAddress(),
    0
  )

  const forwarderContract = await deployForwarderContract(
    adminAddress,
    await hatContract.getAddress(),
    "0x1E81450b1b7c550708b659cA6AF6fADeA3c4B4A4"
  )

  for (const tokenId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    let tx = await gashaItemERC1155Contract.setupNewToken(`${tokenId}.json`)
    await tx.wait()
  }

  // Add Gasha series
  for (let index = 0; index < 14; index++) {
    let tx!: ContractTransactionResponse
    switch (true) {
      case index < 10:
        tx = await gashaContract.setNewSeriesItem(index + 1, 0, 87)
        await tx.wait()
        break
      case index < 13:
        tx = await gashaContract.setNewSeriesItem(index + 1, 1, 40)
        await tx.wait()
        break
      case index == 13:
        tx = await gashaContract.setNewSeriesItem(index + 1, 2, 10)
        await tx.wait()
        break
    }
    tx = await gashaContract.activateSeriesItem(index + 1)
    await tx.wait()
  }

  // Set operator of Gasha
  for (const operatorAddress of operatorAddresses) {
    let tx = await gashaContract.setOperator(operatorAddress, true)
    await tx.wait()
  }

  // Set available time for gasha
  let tx = await gashaContract.setAvailableTime(1711000000, 1912300400)
  await tx.wait()

  // Set minter of GashaItem
  tx = await gashaItemERC1155Contract.setMinter(
    await gashaContract.getAddress(),
    true
  )
  await tx.wait()
  tx = await gashaItemERC1155Contract.setBaseURI(
    "ipfs://QmaiopD3Nc5ujfbQ9GBYjymxmJf7f5mfwFAXRgsMS3xJti/"
  )
  await tx.wait()

  // Set syndicate as operator of Forwarder
  for (const operatorAddress of operatorAddresses) {
    tx = await forwarderContract.setOperator(operatorAddress, true)
    await tx.wait()
  }

  // set forwarder of hat
  tx = await hatContract.setForwarder(await gashaContract.getAddress(), true)
  await tx.wait()
  tx = await hatContract.setForwarder(
    await forwarderContract.getAddress(),
    true
  )
  await tx.wait()

  console.log(
    "ZoraCreator1155 deployed to:",
    await gashaItemERC1155Contract.getAddress()
  )
  console.log("Gasha deployed to:", await gashaContract.getAddress())
  console.log("Hat deployed to:", await hatContract.getAddress())
  console.log("Forwarder deployed to:", await forwarderContract.getAddress())

  return
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
