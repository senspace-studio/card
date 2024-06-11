import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { Card, Gasha, Hat, War, WarPool } from '../typechain-types';
import { ethers } from 'hardhat';
import {
  deployCardContract,
  deployGashaContract,
  deployWarAllContracts,
} from './helper';
import {
  encodePacked,
  keccak256,
  parseEther,
  parseUnits,
  zeroAddress,
} from 'viem';
import { expect } from 'chai';
import { EventLog, getBytes } from 'ethers';
import { deployHatContract } from '../scripts/helper/hat';

describe('War without betting', () => {
  let War: War;
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

    await War.setCardAddress(await Card.getAddress());
    await Card.setBurner(await War.getAddress(), true);
  });

  it('should make game', async () => {
    await Gasha.connect(maker).spin(50, { value: parseEther(`${50 * 100}`) });

    const messageHash = keccak256(
      encodePacked(['uint256', 'uint256'], [BigInt(8), BigInt(2)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    const tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      { value: 0 },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as string;

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
        value: 0,
      }),
    ).emit(War, 'GameChallenged');

    const gameStatus = await War.gameStatus(gameId);
    expect(gameStatus).to.equal(2);
  });

  it('reveal game', async () => {
    await War.connect(dealer).revealCard(gameId, 8, 2);

    const game = await War.games(gameId);

    expect(game.makerCard).to.equal(8);
    expect(game.winner).to.equal(maker.address);
  });
});

describe('War with betting native token', () => {
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
      0,
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

    await Gasha.connect(admin).dropByOwner(
      maker.address,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      Array(14).fill(10),
    );
    await Gasha.connect(admin).dropByOwner(
      challenger.address,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      Array(14).fill(10),
    );
  });

  // Makerが勝つようにゲームを作成
  it('should make game', async () => {
    const messageHash = keccak256(
      encodePacked(['uint256', 'uint256'], [BigInt(10), BigInt(2)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    const tx = await War.connect(maker).makeGame(
      zeroAddress,
      parseEther('100'),
      true,
      signature,
      { value: parseEther('100') },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as string;

    const game = await War.games(gameId);
    expect(game.maker).to.equal(maker.address);
    const gameStatus = await War.gameStatus(gameId);
    expect(gameStatus).to.equal(1);

    const pool = await WarPool.gameDeposits(gameId);
    expect(pool.betAmount).to.equal(parseEther('100'));
    expect(pool.currency).to.equal(zeroAddress);
    expect(pool.maker).to.equal(maker.address);
    // get eth balance of warPool
    const balance = await ethers.provider.getBalance(
      await WarPool.getAddress(),
    );
    expect(balance).to.equal(parseEther('100'));
  });

  it('should fail to challenge game with invalid bet amount', async () => {
    await expect(
      War.connect(challenger).challengeGame(gameId, 9, {
        value: parseEther('50'),
      }),
    ).to.be.revertedWith('War: invalid bet amount');
    await expect(
      War.connect(challenger).challengeGame(gameId, 9, {
        value: parseEther('150'),
      }),
    ).to.be.revertedWith('War: invalid bet amount');
  });

  it('shoud challenge game', async () => {
    await expect(
      War.connect(challenger).challengeGame(gameId, 9, {
        value: parseEther('100'),
      }),
    ).emit(War, 'GameChallenged');

    const gameStatus = await War.gameStatus(gameId);
    expect(gameStatus).to.equal(2);

    const pool = await WarPool.gameDeposits(gameId);
    expect(pool.betAmount).to.equal(parseEther('100'));
    expect(pool.currency).to.equal(zeroAddress);
    expect(pool.challenger).to.equal(challenger.address);
    // get eth balance of warPool
    const balance = await ethers.provider.getBalance(
      await WarPool.getAddress(),
    );
    expect(balance).to.equal(parseEther('200'));
  });

  it('reveal game', async () => {
    const beforeBalanceMaker = Number(
      await ethers.provider.getBalance(maker.address),
    );
    const beforeBalanceChallenger = Number(
      await ethers.provider.getBalance(challenger.address),
    );
    const beforeBalanceWarPool = Number(
      await ethers.provider.getBalance(await WarPool.getAddress()),
    );

    await expect(War.connect(dealer).revealCard(gameId, 10, 2)).emit(
      War,
      'GameRevealed',
    );

    const game = await War.games(gameId);
    expect(game.makerCard).to.equal(10);
    expect(game.winner).to.equal(maker.address);

    const rewardRate = await War.calcRewardRateTop(9);
    const afterBalanceMaker = Number(
      await ethers.provider.getBalance(maker.address),
    );
    const afterBalanceChallenger = Number(
      await ethers.provider.getBalance(challenger.address),
    );
    const afterBalanceWarPool = Number(
      await ethers.provider.getBalance(await WarPool.getAddress()),
    );

    const winningAmount =
      Number(parseEther('100')) * (Number(rewardRate) / 100000);
    const commissionAmount = winningAmount * (1 / 100);
    const rewardAmount =
      winningAmount - commissionAmount + Number(parseEther('100'));
    const returnAmount = Number(parseEther('100')) - winningAmount;

    expect(parseUnits(afterBalanceMaker.toString(), 10)).to.equal(
      parseUnits((beforeBalanceMaker + rewardAmount).toString(), 10),
    );
    expect(parseUnits(afterBalanceChallenger.toString(), 10)).to.equal(
      parseUnits((beforeBalanceChallenger + returnAmount).toString(), 10),
    );
    expect(parseUnits(afterBalanceWarPool.toString(), 10)).to.equal(
      parseUnits(
        (beforeBalanceWarPool - returnAmount - rewardAmount).toString(),
        10,
      ),
    );
  });

  // ToDo: 同じ組み合わせで賭ける場合
});

// 引き分け

// 片方棄権

// 両方棄権

// GameExpireのテスト（時間）
