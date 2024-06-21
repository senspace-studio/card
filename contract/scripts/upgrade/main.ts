import { upgradeGashaContract } from '../helper/gasha';
import { upgradeWarContract, upgradeWarPoolContract } from '../helper/war';

const main = async () => {
  await upgradeWarContract(process.env.WAR_CONTRACT_ADDRESS!);
  // await new Promise((resolve) => setTimeout(resolve, 2000));
  // await upgradeWarPoolContract(process.env.WAR_POOL_CONTRACT_ADDRESS!);
  // await new Promise((resolve) => setTimeout(resolve, 2000));
  // await upgradeGashaContract(process.env.GASHA_CONTRACT_ADDRESS!);
};

main();
