import { ethers, upgrades } from 'hardhat';
import { War, WarPool } from '../../typechain-types';

export const deployWarAllContracts = async (
  initialOwnerAddress: string,
  dealerAddress: string,
) => {
  const warContract = await deployWarContract(
    initialOwnerAddress,
    dealerAddress,
  );
  const warPoolContract = await deployWarPoolContract(initialOwnerAddress);

  warContract.setWarPoolAddress(await warPoolContract.getAddress());
  warPoolContract.setWarAddress(await warContract.getAddress());

  return { warContract, warPoolContract };
};

export const deployWarContract = async (
  initialOwnerAddress: string,
  dealerAddress: string,
) => {
  const warFactory = await ethers.getContractFactory('War');

  const war = (await upgrades.deployProxy(
    warFactory,
    [initialOwnerAddress, dealerAddress],
    {
      initializer: 'initialize',
    },
  )) as any as War;

  await war.waitForDeployment();

  return war;
};

export const deployWarPoolContract = async (initialOwnerAddress: string) => {
  const warPoolFactory = await ethers.getContractFactory('WarPool');

  const warPool = (await upgrades.deployProxy(
    warPoolFactory,
    [initialOwnerAddress],
    {
      initializer: 'initialize',
    },
  )) as any as WarPool;

  await warPool.waitForDeployment();

  return warPool;
};

export const upgradeWarContract = async (address: string) => {
  const warFactory = await ethers.getContractFactory('War');

  const war = (await upgrades.upgradeProxy(address, warFactory)) as any as War;

  await war.waitForDeployment();

  return war;
};
