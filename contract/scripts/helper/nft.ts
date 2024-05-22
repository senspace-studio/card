import { ethers, upgrades } from "hardhat"
import { GashaItem } from "../../typechain-types"

export const deployGashaItemContract = async (initialOwner: string) => {
  const nftFactory = await ethers.getContractFactory("GashaItem")

  const nft = (await upgrades.deployProxy(nftFactory, [initialOwner], {
    initializer: "initialize",
  })) as any as GashaItem
  await nft.waitForDeployment()

  return nft
}
