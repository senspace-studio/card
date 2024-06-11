import { deployGashaContract } from '../helper/gasha';
import { ContractTransactionResponse } from 'ethers';
import { deployCardContract } from '../helper/nft';
import { deployWarAllContracts } from '../helper/war';

const main = async () => {
  const adminAddress = '0x807C69F16456F92ab2bFc9De8f14AF31051f9678';

  const gashaItemERC1155Contract = await deployCardContract(adminAddress);

  const gashaContract = await deployGashaContract(
    adminAddress,
    await gashaItemERC1155Contract.getAddress(),
    0,
  );

  for (const tokenId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    let tx = await gashaItemERC1155Contract.setupNewToken(`${tokenId}.json`);
    await tx.wait();
  }

  // Add Gasha series
  for (let index = 0; index < 14; index++) {
    let tx!: ContractTransactionResponse;
    switch (true) {
      case index < 10:
        tx = await gashaContract.setNewSeriesItem(index + 1, 0, 87);
        await tx.wait();
        break;
      case index < 13:
        tx = await gashaContract.setNewSeriesItem(index + 1, 1, 40);
        await tx.wait();
        break;
      case index == 13:
        tx = await gashaContract.setNewSeriesItem(index + 1, 2, 10);
        await tx.wait();
        break;
    }
    tx = await gashaContract.activateSeriesItem(index + 1);
    await tx.wait();
  }

  // Set available time for gasha
  let tx = await gashaContract.setAvailableTime(1711000000, 1912300400);
  await tx.wait();

  // Set minter of GashaItem
  tx = await gashaItemERC1155Contract.setMinter(
    await gashaContract.getAddress(),
    true,
  );
  await tx.wait();
  tx = await gashaItemERC1155Contract.setBaseURI(
    'ipfs://QmaiopD3Nc5ujfbQ9GBYjymxmJf7f5mfwFAXRgsMS3xJti/',
  );
  await tx.wait();

  // deploy war
  const { warContract, warPoolContract } = await deployWarAllContracts(
    adminAddress,
    adminAddress,
    24 * 60 * 60,
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

  console.log(
    'ZoraCreator1155 deployed to:',
    await gashaItemERC1155Contract.getAddress(),
  );
  console.log('Gasha deployed to:', await gashaContract.getAddress());
  console.log('War deployed to:', await warContract.getAddress());
  console.log('WarPool deployed to:', await warPoolContract.getAddress());

  return;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
