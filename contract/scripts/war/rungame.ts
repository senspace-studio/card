import { EventLog, getBytes, keccak256 } from 'ethers';
import { ethers, network } from 'hardhat';
import { encodePacked, zeroAddress } from 'viem';

const main = async () => {
  const provider = new ethers.JsonRpcProvider(
    'https://nitrorpc-degen-mainnet-1.t.conduit.xyz',
  );
  const dealarAccount = new ethers.Wallet(
    process.env.TEST_PRIVATE_KEY!,
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

  const makerCard = Math.floor(Math.random() * 10) + 1;
  const challengerCard = Math.floor(Math.random() * 10) + 1;

  const maker = Math.random() > 0.5 ? player1Account : player2Account;
  const challenger = maker === player1Account ? player2Account : player1Account;

  const salt = Math.floor(Math.random() * 1000000);

  const messageHash = keccak256(
    encodePacked(['uint256', 'uint256'], [BigInt(makerCard), BigInt(salt)]),
  );

  const signature = (await dealarAccount.signMessage(
    getBytes(messageHash),
  )) as `0x${string}`;

  let tx = await warContract
    .connect(maker)
    .createGame(zeroAddress, 0, true, signature, { value: 0 });
  const receipt = await tx.wait();
  const logs = receipt?.logs as EventLog[];
  const gameId = logs.find((log) => log.eventName === 'GameCreated')
    ?.args[1] as string;

  await new Promise((resolve) => setTimeout(resolve, 3000));

  tx = await warContract
    .connect(challenger)
    .challengeGame(gameId, challengerCard, { value: 0 });
  await tx.wait();

  await new Promise((resolve) => setTimeout(resolve, 3000));

  tx = await warContract
    .connect(dealarAccount)
    .revealCard(gameId, makerCard, salt);
  await tx.wait();

  console.log('GameId:', gameId);
};

main();
