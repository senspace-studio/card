import { ethers, upgrades } from "hardhat"
import { Forwarder, Hat } from "../../typechain-types"

export const deployHatContract = async (initialOwner: string) => {
  const hatFactory = await ethers.getContractFactory("Hat")

  const hat = (await upgrades.deployProxy(
    hatFactory,
    [initialOwner, "Hat", "HAT", 18],
    {
      initializer: "initialize",
    }
  )) as any as Hat

  await hat.waitForDeployment()

  return hat
}

export const deployForwarderContract = async (
  initialOwner: string,
  hat: string,
  lostNFT: string
) => {
  const forwarderFactory = await ethers.getContractFactory("Forwarder")

  const forwarder = (await forwarderFactory.deploy(
    initialOwner,
    hat
  )) as any as Forwarder
  await forwarder.waitForDeployment()

  return forwarder
}

export const deployLostNFTContract = async () => {
  const lostNFTFactory = await ethers.getContractFactory("LostNFTERC1155")

  const lostNFT = await lostNFTFactory.deploy()
  await lostNFT.waitForDeployment()

  return lostNFT
}
