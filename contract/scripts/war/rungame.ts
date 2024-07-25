import { EventLog, getBytes, keccak256 } from 'ethers';
import { ethers, network } from 'hardhat';
import { encodePacked, zeroAddress } from 'viem';

const main = async () => {
  const provider = new ethers.JsonRpcProvider(
    'https://nitrorpc-degen-mainnet-1.t.conduit.xyz',
  );
  const dealarAccount = new ethers.Wallet(
    process.env.LOCAL_PRIVATE_KEY!,
    provider,
  );

  const player1Account = new ethers.Wallet(
    process.env.TEST_PRIVATE_KEY!,
    provider,
  );
  const player2Account = new ethers.Wallet(
    process.env.PLAYER_PRIVATE_KEY!,
    provider,
  );

  const warContract = await ethers.getContractAt(
    'War',
    process.env.WAR_CONTRACT_ADDRESS!,
  );

  const makerCard = [10, 4, 3];
  const challengerCard = [9, 5, 3];

  const maker = Math.random() > 0.5 ? player1Account : player2Account;
  const challenger = maker === player1Account ? player2Account : player1Account;

  const salt = Math.floor(Math.random() * 1000000);

  const makerCardHash = keccak256(
    encodePacked(
      ['uint256', 'uint256', 'uint256'],
      makerCard.map((card) => BigInt(card)) as any,
    ),
  );
  const messageHash = keccak256(
    encodePacked(['uint256', 'uint256'], [BigInt(makerCardHash), BigInt(salt)]),
  );

  const signature = (await dealarAccount.signMessage(
    getBytes(messageHash),
  )) as `0x${string}`;

  let tx = await warContract
    .connect(maker)
    .makeGame(zeroAddress, 0, true, signature, 3, 17, zeroAddress, {
      value: 0,
    });
  const receipt = await tx.wait();
  const logs = receipt?.logs as EventLog[];
  const gameId = logs.find((log) => log.eventName === 'GameMade')
    ?.args[0] as string;

  await new Promise((resolve) => setTimeout(resolve, 3000));

  tx = await warContract
    .connect(challenger)
    .challengeGame(gameId, challengerCard, { value: 0 });
  await tx.wait();

  await new Promise((resolve) => setTimeout(resolve, 3000));

  tx = await warContract.connect(maker).revealCard(gameId, makerCard, salt);
  await tx.wait();

  console.log('GameId:', gameId);
};

main();
