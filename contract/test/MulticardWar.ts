import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Card, Gasha, War } from '../typechain-types';
import { ethers } from 'hardhat';
import {
  deployAndSetupInvitation,
  deployCardContract,
  deployGashaContract,
  deployWarAllContracts,
} from './helper';
import { encodePacked, keccak256, parseEther, zeroAddress } from 'viem';
import { expect } from 'chai';
import { EventLog, getBytes } from 'ethers';

describe('Multi Card War', () => {
  let War: War;
  let Gasha: Gasha;
  let Card: Card;
  let admin: SignerWithAddress;
  let dealer: SignerWithAddress;
  let maker: SignerWithAddress;
  let challenger: SignerWithAddress;
  let gameId: `0x${string}`;

  before(async () => {
    [admin, dealer, maker, challenger] = await ethers.getSigners();

    Card = await deployCardContract(admin.address);

    Gasha = await deployGashaContract(
      admin.address,
      await Card.getAddress(),
      admin.address,
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
        case tokenId < 14:
          tx = await Gasha.setNewSeriesItem(tokenId, 1, 40);
          await tx.wait();
          break;
        case tokenId == 14:
          tx = await Gasha.setNewSeriesItem(tokenId, 2, 10);
          await tx.wait();
          break;
      }
      tx = await Gasha.activateSeriesItem(tokenId - 1);
      await tx.wait();
    }

    let tx = await Gasha.setAvailableTime(0, 1893456000);
    await tx.wait();

    tx = await Card.setMinter(await Gasha.getAddress(), true);
    await tx.wait();
    tx = await Card.setBaseURI('https://zora.co/');

    await tx.wait();

    const deployedContracts = await deployWarAllContracts(
      admin.address,
      dealer.address,
      24 * 60 * 60,
    );
    War = deployedContracts.warContract;

    await War.setCardAddress(await Card.getAddress());
    await Card.setBurner(await War.getAddress(), true);

    await deployAndSetupInvitation(War, Gasha, [
      maker.address,
      challenger.address,
    ]);

    await Gasha.dropByOwner(
      maker.address,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    );
    await Gasha.dropByOwner(
      challenger.address,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10],
    );
  });

  it('should make game', async () => {
    const makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(8), BigInt(5), BigInt(2)],
      ),
    );
    const messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    const tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      3,
      15,
      zeroAddress,
      { value: 0 },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    const game = await War.games(gameId);
    expect(game.maker).to.equal(maker.address);
    const gameStatus = await War.gameStatus(gameId);
    expect(gameStatus).to.equal(1);
  });

  it('shoud challenge game', async () => {
    await expect(
      War.connect(challenger).challengeGame(gameId, [5, 5, 2], {
        value: 0,
      }),
    ).emit(War, 'GameChallenged');

    const gameStatus = await War.gameStatus(gameId);
    expect(gameStatus).to.equal(2);
  });

  it('reveal game', async () => {
    await War.connect(dealer).revealCard(gameId, [8, 5, 2], 1);

    const game = await War.games(gameId);
    const makerCard0 = await War.playerCards(game.makerCard, 0);
    const makerCard1 = await War.playerCards(game.makerCard, 1);
    const makerCard2 = await War.playerCards(game.makerCard, 2);
    expect(makerCard0).to.equal(8);
    expect(makerCard1).to.equal(5);
    expect(makerCard2).to.equal(2);
    expect(game.winner).to.equal(maker.address);
  });

  it('Use joker for win', async () => {
    const makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(13), BigInt(5), BigInt(5)],
      ),
    );
    const messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(2)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    const tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      3,
      23,
      zeroAddress,
      { value: 0 },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    await expect(
      War.connect(challenger).challengeGame(gameId, [14, 13, 10], {
        value: 0,
      }),
    ).emit(War, 'GameChallenged');

    await War.connect(dealer).revealCard(gameId, [13, 5, 5], 2);

    const game = await War.games(gameId);
    const makerCard = await War.playerCards(game.makerCard, 0);
    expect(makerCard).to.equal(13);
    expect(game.winner).to.equal(challenger.address);
  });

  it('should win the game if 1 set against 14', async () => {
    const makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(12), BigInt(5), BigInt(1)],
      ),
    );
    const messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(3)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    const tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      3,
      18,
      zeroAddress,
      { value: 0 },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    await expect(
      War.connect(challenger).challengeGame(gameId, [14, 13, 5], {
        value: 0,
      }),
    ).emit(War, 'GameChallenged');

    await War.connect(dealer).revealCard(gameId, [12, 5, 1], 3);

    const game = await War.games(gameId);
    const makerCard = await War.playerCards(game.makerCard, 0);
    expect(makerCard).to.equal(12);
    expect(game.winner).to.equal(maker.address);
  });
});
