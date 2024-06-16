import { ContractTransactionResponse, parseEther } from 'ethers';
import { deployGashaContract } from '../../helper/gasha';
import { deployCardContract } from '../../helper/nft';

const main = async () => {
  const adminAddress = '0xdCb93093424447bF4FE9Df869750950922F1E30B';

  const cardContract = await deployCardContract(adminAddress);

  const gashaContract = await deployGashaContract(
    adminAddress,
    await cardContract.getAddress(),
    Number(parseEther('100')),
  );

  for (const tokenId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
    let tx = await cardContract.setupNewToken(`${tokenId}.json`);
    await tx.wait();
  }

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

  let tx = await gashaContract.setAvailableTime(1718500000, 1928582400);
  await tx.wait();

  tx = await cardContract.setMinter(await gashaContract.getAddress(), true);
  await tx.wait();

  tx = await cardContract.setBaseURI(
    'https://azure-used-mammal-656.mypinata.cloud/ipfs/QmcTy7zbDRoZ7ofXLi5aTtp8nBCYd54dyk4C955o4ArXFM/',
  );
  await tx.wait();

  tx = await gashaContract.transferOwnership(
    '0xa3F7125A348161517e8a92a64dB1B62C5cda3f0a',
  );
  await tx.wait();

  tx = await cardContract.transferOwnership(
    '0xa3F7125A348161517e8a92a64dB1B62C5cda3f0a',
  );
  await tx.wait();

  console.log('Gasha contract deployed to:', await gashaContract.getAddress());
  console.log('Card contract deployed to:', await cardContract.getAddress());
};

main();
