import { ethers, network } from "hardhat"

const main = async () => {
  const { name } = network

  let gashaAddress = ""
  switch (name) {
    case "base":
      gashaAddress = "0x96E9215696733f7AD091A3D2437dAf892eF296C8"
      break
    case "base_sepolia":
      gashaAddress = "0x90D7eeAd91A64aF5EcC0c45D3Dff5b3d4744208b"
      break
    case "degen":
      gashaAddress = "0x8cC40aa52A79b378AC4C5d9CB155521778372b76"
      break
    default:
      break
  }

  const gashaContract = await ethers.getContractAt("Gasha", gashaAddress)

  let tx = await gashaContract.activateSeriesItem(1)
  await tx.wait()
  tx = await gashaContract.activateSeriesItem(2)
  await tx.wait()
  tx = await gashaContract.activateSeriesItem(3)
  await tx.wait()

  console.log("Activated series items")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
