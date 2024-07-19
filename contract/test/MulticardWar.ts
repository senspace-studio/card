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

const setup = async () => {
  const [admin, dealer, maker, challenger] = await ethers.getSigners();

  const Card = await deployCardContract(admin.address);

  const Gasha = await deployGashaContract(
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
  const War = deployedContracts.warContract;

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

  return { War, Gasha, Card, admin, dealer, maker, challenger };
};

describe('Multi Card War', () => {
  let War: War;
  let dealer: SignerWithAddress;
  let maker: SignerWithAddress;
  let challenger: SignerWithAddress;
  let gameId: `0x${string}`;

  before(async () => {
    const contracts = await setup();
    War = contracts.War;
    dealer = contracts.dealer;
    maker = contracts.maker;
    challenger = contracts.challenger;
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

  it('Joker is not included in 25', async () => {
    const makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(14), BigInt(13), BigInt(12)],
      ),
    );
    const messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(5)]),
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
      25,
      zeroAddress,
      { value: 0 },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    await expect(
      War.connect(challenger).challengeGame(gameId, [13, 10, 2], {
        value: 0,
      }),
    ).emit(War, 'GameChallenged');

    await War.connect(dealer).revealCard(gameId, [14, 13, 12], 5);

    const game = await War.games(gameId);
    const makerCard = await War.playerCards(game.makerCard, 0);
    expect(makerCard).to.equal(14);
    expect(game.winner).to.equal(maker.address);
  });

  it('5 cards game', async () => {
    const makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [BigInt(10), BigInt(7), BigInt(3), BigInt(2), BigInt(2)],
      ),
    );
    const messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(6)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    const tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      5,
      24,
      zeroAddress,
      { value: 0 },
    );
    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    await expect(
      War.connect(challenger).challengeGame(gameId, [14, 13, 5, 3, 3], {
        value: 0,
      }),
    ).emit(War, 'GameChallenged');

    await War.connect(dealer).revealCard(gameId, [7, 10, 3, 2, 2], 6);

    const game = await War.games(gameId);
    const makerCard0 = await War.playerCards(game.makerCard, 0);
    const makerCard1 = await War.playerCards(game.makerCard, 1);
    const makerCard2 = await War.playerCards(game.makerCard, 2);
    const makerCard3 = await War.playerCards(game.makerCard, 3);
    const makerCard4 = await War.playerCards(game.makerCard, 4);
    expect(makerCard0).to.equal(10);
    expect(makerCard1).to.equal(7);
    expect(makerCard2).to.equal(3);
    expect(makerCard3).to.equal(2);
    expect(makerCard4).to.equal(2);
    expect(game.winner).to.equal(challenger.address);
  });
});

describe('Illegal Cases', () => {
  let War: War;
  let dealer: SignerWithAddress;
  let maker: SignerWithAddress;
  let challenger: SignerWithAddress;
  let gameId: `0x${string}`;

  before(async () => {
    const contracts = await setup();
    War = contracts.War;
    dealer = contracts.dealer;
    maker = contracts.maker;
    challenger = contracts.challenger;
  });

  it('Players should set cards between 14-25', async () => {
    let makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(13), BigInt(11), BigInt(2)],
      ),
    );

    let messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    let signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    await expect(
      War.connect(maker).makeGame(
        zeroAddress,
        0,
        true,
        signature,
        3,
        26,
        zeroAddress,
        { value: 0 },
      ),
    ).to.be.revertedWith('War: sum should be b/w 14-25 for multi-cards');

    makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(5), BigInt(5), BigInt(2)],
      ),
    );

    messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    await expect(
      War.connect(maker).makeGame(
        zeroAddress,
        0,
        true,
        signature,
        3,
        12,
        zeroAddress,
        { value: 0 },
      ),
    ).to.be.revertedWith('War: sum should be b/w 14-25 for multi-cards');

    makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(10), BigInt(9), BigInt(2)],
      ),
    );

    messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    let tx = await War.connect(maker).makeGame(
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

    await expect(
      War.connect(challenger).challengeGame(gameId, [13, 11, 2], {
        value: 0,
      }),
    ).revertedWith('War: invalid card sum');
  });

  it('Players cannot set except 3 or 5 cards', async () => {
    let makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256', 'uint256'],
        [BigInt(4), BigInt(4), BigInt(2), BigInt(2)],
      ),
    );

    let messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    let signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    // Makerが4枚のカードを使う
    await expect(
      War.connect(maker).makeGame(
        zeroAddress,
        0,
        true,
        signature,
        4,
        12,
        zeroAddress,
        { value: 0 },
      ),
    ).to.be.revertedWith('War: only 1, 3, 5 cards are allowed');

    makerCardHash = keccak256(
      encodePacked(['uint256', 'uint256'], [BigInt(5), BigInt(5)]),
    );

    messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    // Makerが2枚のカードを使う
    await expect(
      War.connect(maker).makeGame(
        zeroAddress,
        0,
        true,
        signature,
        2,
        10,
        zeroAddress,
        { value: 0 },
      ),
    ).to.be.revertedWith('War: only 1, 3, 5 cards are allowed');

    makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(10), BigInt(9), BigInt(2)],
      ),
    );

    messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(2)]),
    );

    signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    let tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      3,
      21,
      zeroAddress,
      { value: 0 },
    );

    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    // Challengerが4枚のカードを使う
    await expect(
      War.connect(challenger).challengeGame(gameId, [6, 5, 5, 5], {
        value: 0,
      }),
    ).revertedWith('War: invalid card length');

    // Challengerが2枚のカードを使う
    await expect(
      War.connect(challenger).challengeGame(gameId, [6, 5], {
        value: 0,
      }),
    ).revertedWith('War: invalid card length');
  });

  it('Challenger should not use cards exceeding the sum of cards', async () => {
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

    let tx = await War.connect(maker).makeGame(
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

    await expect(
      War.connect(challenger).challengeGame(gameId, [8, 5, 3], {
        value: 0,
      }),
    ).to.be.revertedWith('War: invalid card sum');
  });

  it('Maker should not change card after make game', async () => {
    const makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(8), BigInt(5), BigInt(2)],
      ),
    );

    const messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(2)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    let tx = await War.connect(maker).makeGame(
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

    tx = await War.connect(challenger).challengeGame(gameId, [5, 5, 2], {
      value: 0,
    });
    await tx.wait();

    // MakeGameのときの合計値より大きい数字を使う
    await expect(
      War.connect(maker).revealCard(gameId, [8, 5, 3], 1),
    ).to.be.revertedWith('War: invalid card sum');

    // MakeGameのときの合計値より小さい数字を使う
    await expect(
      War.connect(maker).revealCard(gameId, [8, 5, 1], 1),
    ).to.be.revertedWith('War: invalid card sum');

    // MakeGameと同じだが、違う組み合わせを使う
    await expect(
      War.connect(maker).revealCard(gameId, [9, 4, 2], 1),
    ).to.be.revertedWith('War: invalid signature');

    // MakeGameと違うカード枚数を使う
    await expect(
      War.connect(maker).revealCard(gameId, [5, 5, 2, 2, 1], 1),
    ).to.be.revertedWith('War: invalid card length');
  });

  it('Maker cannot lie num of cards when make game', async () => {
    const makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [BigInt(8), BigInt(5), BigInt(2), BigInt(2), BigInt(2)],
      ),
    );

    const messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(2)]),
    );

    const signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    let tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      3,
      19,
      zeroAddress,
      { value: 0 },
    );

    const receipt = await tx.wait();
    const logs = receipt?.logs as EventLog[];
    gameId = logs.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    tx = await War.connect(challenger).challengeGame(gameId, [8, 8, 3], {
      value: 0,
    });
    await tx.wait();

    await expect(
      War.connect(dealer).revealCard(gameId, [8, 5, 2, 2, 2], 1),
    ).to.be.revertedWith('War: invalid card length');
  });

  it('Users should not use Joker twice', async () => {
    let makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256'],
        [BigInt(13), BigInt(5), BigInt(5)],
      ),
    );

    let messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    let signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    let tx = await War.connect(maker).makeGame(
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
      War.connect(challenger).challengeGame(gameId, [14, 14, 13], {
        value: 0,
      }),
    ).to.be.revertedWith('War: Joker can be used only once');

    makerCardHash = keccak256(
      encodePacked(
        ['uint256', 'uint256', 'uint256', 'uint256', 'uint256'],
        [BigInt(14), BigInt(14), BigInt(13), BigInt(5), BigInt(5)],
      ),
    );

    messageHash = keccak256(
      encodePacked(['bytes32', 'uint256'], [makerCardHash, BigInt(1)]),
    );

    signature = (await dealer.signMessage(
      getBytes(messageHash),
    )) as `0x${string}`;

    tx = await War.connect(maker).makeGame(
      zeroAddress,
      0,
      true,
      signature,
      5,
      23,
      zeroAddress,
      { value: 0 },
    );

    const receipt2 = await tx.wait();
    const logs2 = receipt2?.logs as EventLog[];
    gameId = logs2.find((log) => log.eventName === 'GameMade')
      ?.args[0] as `0x${string}`;

    tx = await War.connect(challenger).challengeGame(gameId, [6, 5, 4, 3, 2], {
      value: 0,
    });

    await tx.wait();

    await expect(
      War.connect(dealer).revealCard(gameId, [14, 14, 13, 5, 5], 1),
    ).to.be.revertedWith('War: Joker can be used only once');
  });
});
