import { ethers } from "hardhat"

const main = async () => {
  const gashaContract = await ethers.getContractAt(
    "Gasha",
    "0x8cC40aa52A79b378AC4C5d9CB155521778372b76"
  )

  // let tx = await gashaContract.setAvailableTime(1711639025, 1811640405)
  let tx = await gashaContract.setAvailableTime(1711000000, 1912300400)
  await tx.wait()

  console.log("Set Available Time")
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
