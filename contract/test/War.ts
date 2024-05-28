import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Card, Gasha, Hat, War, WarPool } from '../typechain-types';
import { ethers } from 'hardhat';
import {
  deployCardContract,
  deployGashaContract,
  deployWarAllContracts,
} from './helper';
import { encodePacked, keccak256, parseEther, zeroAddress } from 'viem';
import { expect } from 'chai';
import { EventLog, getBytes } from 'ethers';
import { deployHatContract } from '../scripts/helper/hat';

describe('War', () => {
  let War: War;
  let WarPool: WarPool;
  let Gasha: Gasha;
  let Card: Card;
  let Hat: Hat;
  let admin: SignerWithAddress;
  let dealer: SignerWithAddress;
  let maker: SignerWithAddress;
  let challenger: SignerWithAddress;
  let gameId: string;

  before(async () => {
    [admin, dealer, maker, challenger] = await ethers.getSigners();

    Card = await deployCardContract(admin.address);
    Hat = await deployHatContract(admin.address);
    Gasha = await deployGashaContract(
      admin.address,
      await Card.getAddress(),
      await Hat.getAddress(),
      100,
    );

    for (const tokenId of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]) {
      let tx = await Card.setupNewToken(`${tokenId}.json`);
      await tx.wait();

      switch (true) {
        case tokenId < 10:
          tx = await Gasha.setNewSeriesItem(tokenId, 0, 87);
          await tx.wait();
          break;
        case tokenId < 13:
          tx = await Gasha.setNewSeriesItem(tokenId, 1, 40);
          await tx.wait();
          break;
        case tokenId == 13:
          tx = await Gasha.setNewSeriesItem(tokenId, 2, 10);
          await tx.wait();
          break;
      }
      tx = await Gasha.activateSeriesItem(tokenId);
      await tx.wait();
    }

    let tx = await Gasha.setAvailableTime(0, 1893456000);
    await tx.wait();

    tx = await Card.setMinter(await Gasha.getAddress(), true);
    await tx.wait();
    tx = await Card.setBaseURI('https://zora.co/');

    tx = await Hat.setForwarder(await Gasha.getAddress(), true);
    await tx.wait();

    const deployedContracts = await deployWarAllContracts(
      admin.address,
      dealer.address,
    );
    War = deployedContracts.warContract;
    WarPool = deployedContracts.warPoolContract;

    await War.setCardAddress(await Card.getAddress());
    await Card.setBurner(await War.getAddress(), true);
  });

  it('should make game', async () => {
    await Gasha.connect(maker).spin(50, { value: parseEther(`${50 * 100}`) });

    const messageHash = keccak256(
      encodePacked(['uint256', 'uint256'], [BigInt(1), BigInt(2)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    const tx = await War.connect(maker).createGame(
      zeroAddress,
      parseEther('100'),
      true,
      signature,
      { value: parseEther('100') },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameCreated')
      ?.args[1] as string;

    const game = await War.games(gameId);
    expect(game.maker).to.equal(maker.address);
    const gameStatus = await War.gameStatus(gameId);
    expect(gameStatus).to.equal(1);
  });

  it('shoud challenge game', async () => {
    await Gasha.connect(challenger).spin(50, {
      value: parseEther(`${50 * 100}`),
    });

    await expect(
      War.connect(challenger).challengeGame(gameId, 5, {
        value: parseEther('100'),
      }),
    ).emit(War, 'GameChallenged');

    const gameStatus = await War.gameStatus(gameId);
    expect(gameStatus).to.equal(2);
  });

  it('reveal game', async () => {
    await War.connect(dealer).revealCard(gameId, 1, 2);

    const game = await War.games(gameId);

    expect(game.makerCard).to.equal(1);
    expect(game.winner).to.equal(challenger.address);
  });
});
