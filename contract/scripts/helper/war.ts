import { ethers, upgrades } from 'hardhat';
import { War, WarPool, WarTournament } from '../../typechain-types';

export const deployWarAllContracts = async (
  initialOwnerAddress: string,
  dealerAddress: string,
  expirationTime: number,
  tournament: boolean = false,
) => {
  const warContract = tournament
    ? await deployWarTournamentContract(
        initialOwnerAddress,
        dealerAddress,
        expirationTime,
      )
    : await deployWarContract(
        initialOwnerAddress,
        dealerAddress,
        expirationTime,
      );
  const warPoolContract = await deployWarPoolContract(initialOwnerAddress);

  let tx = await warContract.setWarPoolAddress(
    await warPoolContract.getAddress(),
  );
  await tx.wait();
  tx = await warPoolContract.setWarAddress(await warContract.getAddress());
  await tx.wait();

  return { warContract, warPoolContract };
};

export const deployWarContract = async (
  initialOwnerAddress: string,
  dealerAddress: string,
  expirationTime: number,
) => {
  const warFactory = await ethers.getContractFactory('War');

  const war = (await upgrades.deployProxy(
    warFactory,
    [initialOwnerAddress, dealerAddress, expirationTime],
    {
      initializer: 'initialize',
    },
  )) as any as War;

  await war.waitForDeployment();

  return war;
};

export const deployWarTournamentContract = async (
  initialOwnerAddress: string,
  dealerAddress: string,
  expirationTime: number,
) => {
  const warFactory = await ethers.getContractFactory('WarTournament');

  const war = (await upgrades.deployProxy(
    warFactory,
    [initialOwnerAddress, dealerAddress, expirationTime],
    {
      initializer: 'initialize',
    },
  )) as any as WarTournament;

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

export const upgradeWarPoolContract = async (address: string) => {
  const warPoolFactory = await ethers.getContractFactory('WarPool');

  const warPool = (await upgrades.upgradeProxy(
    address,
    warPoolFactory,
  )) as any as WarPool;

  await warPool.waitForDeployment();

  return warPool;
};
