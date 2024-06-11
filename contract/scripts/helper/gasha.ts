import { ethers, upgrades } from 'hardhat';
import { Gasha } from '../../typechain-types';
import { parseEther } from 'ethers';

export const deployGashaContract = async (
  adminAddress: string,
  gashaItemERC1155Address: string,
  unitPrice: number,
) => {
  const gashaFactory = await ethers.getContractFactory('Gasha');

  const gasha = (await upgrades.deployProxy(
    gashaFactory,
    [
      adminAddress,
      gashaItemERC1155Address,
      10000,
      parseEther(unitPrice.toString()),
    ],
    {
      initializer: 'initialize',
    },
  )) as any as Gasha;
  await gasha.waitForDeployment();
  return gasha;
};

export const upgradeGashaContract = async (address: string) => {
  const gashaFactory = await ethers.getContractFactory('Gasha');
  const gasha = (await upgrades.upgradeProxy(
    address,
    gashaFactory,
  )) as any as Gasha;

  await gasha.waitForDeployment();

  return gasha;
};
