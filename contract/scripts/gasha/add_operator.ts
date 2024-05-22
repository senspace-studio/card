import { parseEther } from "ethers"
import { ethers } from "hardhat"

const main = async () => {
  const forwarderContract = await ethers.getContractAt(
    "Forwarder",
    "0x46ed7A57a3057842890A9a3B436a63e5b39Ba907"
  )
  const gashaContract = await ethers.getContractAt(
    "Gasha",
    "0xD9022B1Da60425B78e20fC4d17B97943e11f422F"
  )

  let tx = await forwarderContract.burnAndRedeemReward(
    "0xD0575cA24D907b35d39383a53c3300D510446BaE",
    parseEther("1"),
    "test"
  )

  await tx.wait()

  console.log(tx)

  // let tx = await forwarderContract.setOperator(
  //   "0x807C69F16456F92ab2bFc9De8f14AF31051f9678",
  //   true
  // )
  // await tx.wait()

  // tx = await gashaContract.setOperator(
  //   "0x807C69F16456F92ab2bFc9De8f14AF31051f9678",
  //   true
  // )
  // await tx.wait()
}

main()
