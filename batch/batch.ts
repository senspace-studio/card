import { Chain, createPublicClient, http, zeroAddress } from 'viem';
import { degen } from 'viem/chains';
import tweClient from './thirdweb-engine';

const BLOCKCHAIN_API = process.env.BLOCKCHAIN_API || 'https://base-sepolia.g.alchemy.com/v2/MYloSJq0Z0iYnAE7k36ApaRl5RfHtjlh';
const WAR_CONTRACT_ADDRESS = process.env.WAR_CONTRACT_ADDRESS || '0xedCB16F9abA99F564B02c8f37a138317583D11a8';

type GameRevealedEventLog = {
  gameId: string;
  maker: string;
  challenger: string;
  winner: string;
};

const viemClient = createPublicClient({
  chain: { ...degen, fees: { baseFeeMultiplier: 1.25 } } as Chain,
  transport: http(BLOCKCHAIN_API),
});

const getBlockNumberFromTimestamp = async (timestamp: number) => {
  const res = await fetch(`https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=after`);
  const { result: { blockNumber } } = await res.json() as { result: { blockNumber: string } };
  return blockNumber;
}

const getGameLogs = async (startDateUnix: number, endDateUnix: number) => {
  const [fromBlock_game, toBlock_game] = await Promise.all([
    getBlockNumberFromTimestamp(startDateUnix),
    getBlockNumberFromTimestamp(endDateUnix),
  ]);
  console.log(fromBlock_game, toBlock_game);
  let res = (await tweClient.POST(
    '/contract/{chain}/{contractAddress}/events/get',
    {
      params: {
        path: {
          chain: 'degen-chain',
          contractAddress: WAR_CONTRACT_ADDRESS,
        },
      },
      body: {
        eventName: 'GameRevealed',
        fromBlock: fromBlock_game,
        toBlock: toBlock_game,
      } as never,
    },
  )) as any;
  const gameData: {
    result: {
      eventName: string,
      data: any,
      transaction: any,
    }[]
  } = res.data;
  for (const event of gameData.result) {
    console.log(event);
  }
  return gameData.result.map((r) => ({ ...r.data })) as unknown as GameRevealedEventLog[];
}

export const calcLatest7DaysResult = async () => {
  const currentUnixTime = Math.floor(new Date().getTime() / 1e3);
  // 7 days before
  const startDateUnix = currentUnixTime - 7 * 24 * 60 * 60;
  const gameRevealedlogs = await getGameLogs(startDateUnix, currentUnixTime);
  const resultJson: { [address: string]: { win: number, lose: number, draw: number } } = {};
  const init = (address: string) => {
    if (!resultJson[address]) {
      resultJson[address] = { win: 0, lose: 0, draw: 0 };
    }
  }
  for (const { maker, challenger, winner } of gameRevealedlogs) {
    if (!resultJson[maker]) {
      init(maker);
    }
    if (!resultJson[challenger]) {
      init(challenger);
    }
    if (winner === zeroAddress) {
      resultJson[maker].draw++;
      resultJson[challenger].draw++;
    } else if (winner === maker) {
      resultJson[maker].win++;
      resultJson[challenger].lose++;
    } else if (winner === challenger) {
      resultJson[maker].lose++;
      resultJson[challenger].win++;
    }
  }
  const result: { address: string, win: number, lose: number, draw: number }[] = [];
  for (const address in resultJson) {
    if (address !== zeroAddress) {
      result.push({ address, ...resultJson[address] });
    }
  }
  console.log(result);
  return result;
}

export const calcInvitationEffect = (
  ignoredAddressList: string[],
  ignoredTokenIdList: string[],
) => {
  // ToDo
};

calcLatest7DaysResult();
