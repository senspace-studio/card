import {
  Forwarder,
  Gasha,
  Card,
  Hat,
  LostNFTERC1155,
} from '../typechain-types';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { deployGashaContract, deployCardContract } from './helper';
import {
  deployForwarderContract,
  deployHatContract,
  deployLostNFTContract,
} from '../scripts/helper/hat';
import { formatEther, parseEther } from 'ethers';
import { expect } from 'chai';

describe('Hat', () => {
  let Gasha: Gasha;
  let GashaItem: Card;
  let Hat: Hat;
  let LostNFTERC1155: LostNFTERC1155;
  let Forwarder: Forwarder;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let operator: SignerWithAddress;

  before(async () => {
    [admin, user, operator] = await ethers.getSigners();

    GashaItem = await deployCardContract(admin.address);

    Hat = await deployHatContract(admin.address);

    Gasha = await deployGashaContract(
      admin.address,
      await GashaItem.getAddress(),
      await Hat.getAddress(),
      0.000777,
    );

    LostNFTERC1155 = await deployLostNFTContract();

    Forwarder = await deployForwarderContract(
      admin.address,
      await Hat.getAddress(),
      await LostNFTERC1155.getAddress(),
    );

    for (const tokenId of [1, 2, 3]) {
      let tx = await GashaItem.setupNewToken(`https://zora.co/${tokenId}`);
      await tx.wait();
    }

    let tx = await GashaItem.setMinter(await Gasha.getAddress(), true);
    await tx.wait();
    tx = await Hat.setForwarder(await Gasha.getAddress(), true);
    await tx.wait();

    tx = await Gasha.setOperator(operator.address, true);
    await tx.wait();

    tx = await Gasha.setNewSeriesItem(1, 0, 800);
    await tx.wait();
    tx = await Gasha.activateSeriesItem(1);
    await tx.wait();

    tx = await Gasha.setNewSeriesItem(2, 1, 150);
    await tx.wait();
    tx = await Gasha.activateSeriesItem(2);
    await tx.wait();

    tx = await Gasha.setNewSeriesItem(3, 2, 50);
    await tx.wait();
    tx = await Gasha.activateSeriesItem(3);
    await tx.wait();

    tx = await Gasha.setAvailableTime(0, 1893456000);
    await tx.wait();

    tx = await Gasha.connect(user).spin(10, {
      value: parseEther(String(0.000777 * 10)),
    });
    await tx.wait();

    tx = await Forwarder.setOperator(operator.address, true);
    await tx.wait();

    const sendEth = await admin.sendTransaction({
      to: await Forwarder.getAddress(),
      value: parseEther('2000'),
    });
    await sendEth.wait();

    tx = await Hat.setForwarder(await Gasha.getAddress(), true);
    await tx.wait();
    tx = await Hat.setForwarder(await Forwarder.getAddress(), true);
    await tx.wait();
  });

  it('shoud burn and redeem reward', async () => {
    const userHatERC721Balance = await Hat.erc721BalanceOf(user.address);
    const userEtherBalance = await ethers.provider.getBalance(user.address);

    const tx = await Forwarder.connect(operator).burnAndRedeemReward(
      user.address,
      parseEther('1000'),
      '',
    );
    await tx.wait();

    const userHatERC721BalanceAfter = await Hat.erc721BalanceOf(user.address);
    const userEtherBalanceAfter = await ethers.provider.getBalance(
      user.address,
    );

    expect(Number(userHatERC721BalanceAfter)).to.equal(
      Number(userHatERC721Balance) - 1,
    );
    expect(Number(formatEther(userEtherBalanceAfter))).to.equal(
      Number(formatEther(userEtherBalance)) + 1000,
    );
  });

  it('should burn and redeem lost nft', async () => {
    const userHatERC721Balance = await Hat.erc721BalanceOf(user.address);

    const tx = await Forwarder.connect(operator).burn(user.address, '');
    await tx.wait();

    const userHatERC721BalanceAfter = await Hat.erc721BalanceOf(user.address);

    expect(Number(userHatERC721BalanceAfter)).to.equal(
      Number(userHatERC721Balance) - 1,
    );
  });
});
