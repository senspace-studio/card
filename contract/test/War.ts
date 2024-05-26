import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { War, WarPool } from '../typechain-types';
import { ethers } from 'hardhat';
import { deployWarAllContracts } from './helper';
import {
  encodePacked,
  keccak256,
  parseEther,
  recoverAddress,
  zeroAddress,
} from 'viem';
import { expect } from 'chai';
import { EventLog, getBytes } from 'ethers';
import { war } from '../typechain-types/contracts';

describe('War', () => {
  let War: War;
  let WarPool: WarPool;
  let admin: SignerWithAddress;
  let dealer: SignerWithAddress;
  let maker: SignerWithAddress;
  let challenger: SignerWithAddress;

  before(async () => {
    [admin, dealer, maker, challenger] = await ethers.getSigners();

    const deployedContracts = await deployWarAllContracts(
      admin.address,
      dealer.address,
    );
    War = deployedContracts.warContract;
    WarPool = deployedContracts.warPoolContract;
  });

  let gameId: string;

  it('should make game', async () => {
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
  });
});
