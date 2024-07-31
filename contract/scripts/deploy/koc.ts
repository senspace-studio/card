import { deployGashaContract } from '../helper/gasha';
import { ContractTransactionResponse } from 'ethers';
import { deployCardContract } from '../helper/nft';
import { deployWarAllContracts } from '../helper/war';

const main = async () => {
  const adminAddress = '0xdCb93093424447bF4FE9Df869750950922F1E30B';
  const dealerAddress = '0x8cAa11dD0a4AcA1Fd19241497f6d6bD81bD13C83';
  const invitationAddress = '0x506988d90f9FeE74b9eDC009E8CFBAc918F541dd';
  const minterAddress = '0xa3F7125A348161517e8a92a64dB1B62C5cda3f0a';

  const gashaItemERC1155Contract = await deployCardContract(adminAddress);

  for (const tokenId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    let tx = await gashaItemERC1155Contract.setupNewToken(`${tokenId}.json`);
    await tx.wait();
  }

  let tx = await gashaItemERC1155Contract.setBaseURI(
    'https://azure-used-mammal-656.mypinata.cloud/ipfs/QmbrLN2q55LzkD17FS2qYnDfoW4WGwWZqooVyfBZWEPcDS/',
  );
  await tx.wait();

  tx = await gashaItemERC1155Contract.setMinter(minterAddress, true);
  await tx.wait();

  // deploy war
  const { warContract, warPoolContract } = await deployWarAllContracts(
    adminAddress,
    dealerAddress,
    4 * 60 * 60,
    true,
  );
  await new Promise((r) => setTimeout(r, 3000));
  tx = await warContract.setCardAddress(
    await gashaItemERC1155Contract.getAddress(),
  );
  await tx.wait();
  await new Promise((r) => setTimeout(r, 3000));
  tx = await warContract.setWarPoolAddress(await warPoolContract.getAddress());
  await tx.wait();
  await new Promise((r) => setTimeout(r, 3000));
  tx = await warPoolContract.setWarAddress(await warContract.getAddress());
  await tx.wait();
  await new Promise((r) => setTimeout(r, 3000));
  tx = await gashaItemERC1155Contract.setBurner(
    await warContract.getAddress(),
    true,
  );
  tx = await warContract.setInvitationAddress(invitationAddress);

  console.log(
    'ZoraCreator1155 deployed to:',
    await gashaItemERC1155Contract.getAddress(),
  );
  console.log('War deployed to:', await warContract.getAddress());
  console.log('WarPool deployed to:', await warPoolContract.getAddress());

  return;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
