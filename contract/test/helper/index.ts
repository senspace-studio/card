import { ethers } from 'hardhat';
import { Gasha, War, WarPool } from '../../typechain-types';

export * from '../../scripts/helper/gasha';
export * from '../../scripts/helper/nft';
export * from '../../scripts/helper/war';

export const deployAndSetupInvitation = async (
  War: War,
  Gasha: Gasha,
  list: string[],
) => {
  const factory = await ethers.getContractFactory('TestInvitation');
  const invitation = await factory.deploy();

  await War.setInvitationAddress(await invitation.getAddress());
  await Gasha.setInvitationAddress(await invitation.getAddress());

  for (const addr of list) {
    await invitation.mint(addr);
  }

  return invitation;
};
