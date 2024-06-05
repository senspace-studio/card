import { upgradeWarContract } from '../helper/war';

const main = async () => {
  await upgradeWarContract(process.env.WAR_CONTRACT_ADDRESS!);
};

main();
