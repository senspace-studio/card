import { ethers, upgrades } from 'hardhat';
import { Card } from '../../typechain-types';

export const deployCardContract = async (initialOwner: string) => {
  const nftFactory = await ethers.getContractFactory('Card');

  const nft = (await upgrades.deployProxy(nftFactory, [initialOwner], {
    initializer: 'initialize',
  })) as any as Card;
  await nft.waitForDeployment();

  return nft;
};

export const upgradeCardContract = async (address: string) => {
  const nftFactory = await ethers.getContractFactory('Card');
  const nft = (await upgrades.upgradeProxy(address, nftFactory)) as any as Card;

  await nft.waitForDeployment();

  return nft;
};
