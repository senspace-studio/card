import { ethers } from 'hardhat';

const main = async () => {
  const ownerAddress = '0xD58916bcfBEf97F88DB399A5bc6f741813048025';

  const factory = await ethers.getContractFactory('StackVariables');
  const contract = await factory.deploy(ownerAddress);

  await contract.waitForDeployment();

  console.log('StackVariables deployed to:', await contract.getAddress());
};

main();
