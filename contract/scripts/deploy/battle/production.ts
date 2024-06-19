import { ethers } from 'hardhat';
import { deployWarAllContracts } from '../../helper/war';

const main = async () => {
  const adminAddress = '0xdCb93093424447bF4FE9Df869750950922F1E30B';
  const cardAddress = '0x860160c7f0EBBf2FA911bE099E7BB0752002A211';
  const invitationAddress = '0x287316C0c8bAF352803855a87F4f35e8AD374F29';

  const { warContract, warPoolContract } = await deployWarAllContracts(
    adminAddress,
    '0x8cAa11dD0a4AcA1Fd19241497f6d6bD81bD13C83',
    24 * 60 * 60,
  );

  // const cardContract = await ethers.getContractAt('Card', cardAddress);

  await warContract.setCardAddress(cardAddress);
  // await cardContract.setBurner(await warContract.getAddress(), true);

  await warContract.setInvitationAddress(invitationAddress);

  await warContract.transferOwnership(
    '0xa3F7125A348161517e8a92a64dB1B62C5cda3f0a',
  );
  await warPoolContract.transferOwnership(
    '0xa3F7125A348161517e8a92a64dB1B62C5cda3f0a',
  );

  console.log('War contract deployed to:', await warContract.getAddress());
  console.log(
    'WarPool contract deployed to:',
    await warPoolContract.getAddress(),
  );
};

main();
