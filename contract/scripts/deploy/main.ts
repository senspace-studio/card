import { deployGashaContract } from "../helper/gasha"
import { deployGashaItemContract } from "../helper/nft"
import { deployForwarderContract, deployHatContract } from "../helper/hat"
import { ContractTransactionResponse } from "ethers"

const main = async () => {
  const adminAddress = "0x807C69F16456F92ab2bFc9De8f14AF31051f9678"
  const syndicateAddresses = [
    "0x6A835d6bd3d5fE1D1Ac8dB2Ce2f707f95892Ea28",
    "0xe79B0AF60EECd70eb738C113734483D9D14959Ae",
  ]

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

  // Set syndicate as Operator of Gasha
  for (const syndicateAddress of syndicateAddresses) {
    let tx = await gashaContract.setOperator(syndicateAddress, true)
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
  for (const syndicateAddress of syndicateAddresses) {
    tx = await forwarderContract.setOperator(syndicateAddress, true)
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

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
