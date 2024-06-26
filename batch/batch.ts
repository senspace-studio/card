import 'dotenv/config';
import { Chain, createPublicClient, http, zeroAddress } from 'viem';
import { degen } from 'viem/chains';
import tweClient from './thirdweb-engine';

const BLOCKCHAIN_API = process.env.BLOCKCHAIN_API || '';
const WAR_CONTRACT_ADDRESS = process.env.WAR_CONTRACT_ADDRESS || '';
const INVITATION_CONTRACT_ADDRESS = process.env.INVITATION_CONTRACT_ADDRESS || '';

type GameRevealedEventLog = {
  gameId: string;
  maker: string;
  challenger: string;
  winner: string;
};

type TransferEventLog = {
  from: string;
  to: string;
  tokenId: { type: string, hex: string };
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

const getContractEventLogs = async <E>(contractAddress: string, eventName: string, startDateUnix: number, endDateUnix: number) => {
  const [fromBlock, toBlock] = await Promise.all([
    getBlockNumberFromTimestamp(startDateUnix),
    getBlockNumberFromTimestamp(endDateUnix),
  ]);
  const res = (await tweClient.POST(
    '/contract/{chain}/{contractAddress}/events/get',
    {
      params: {
        path: {
          chain: 'degen-chain',
          contractAddress,
        },
      },
      body: {
        eventName,
        fromBlock,
        toBlock,
      } as never,
    },
  )) as any;
  const { result }: {
    result: {
      eventName: string,
      data: any,
      transaction: any,
    }[]
  } = res.data;
  // 古いログが小さいインデックス
  return result.reverse().map((r) => ({ ...r.data })) as unknown as E[];
};

const getGameRevealedLogs = async (startDateUnix: number, endDateUnix: number) => {
  return await getContractEventLogs<GameRevealedEventLog>(
    WAR_CONTRACT_ADDRESS,
    'GameRevealed',
    startDateUnix,
    endDateUnix,
  );
}

const getInvivationTransferLogs = async (startDateUnix: number, endDateUnix: number) => {
  return await getContractEventLogs<TransferEventLog>(
    INVITATION_CONTRACT_ADDRESS,
    'Transfer',
    startDateUnix,
    endDateUnix,
  );
}

export const calcLatest7DaysResult = async () => {
  const currentUnixTime = Math.floor(new Date().getTime() / 1e3);
  // 7 days before
  const startDateUnix = currentUnixTime - 7 * 24 * 60 * 60;
  const logs = await getGameRevealedLogs(startDateUnix, currentUnixTime);
  const resultJson: { [address: string]: { win: number, lose: number, draw: number } } = {};
  const init = (address: string) => {
    if (!resultJson[address]) {
      resultJson[address] = { win: 0, lose: 0, draw: 0 };
    }
  }
  for (const { maker, challenger, winner } of logs) {
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
  // console.log(result);
  return result;
}

export const calcInvitationEffect = async (
  ignoredAddressList: string[],
  ignoredTokenIdList: string[],
) => {
  ignoredAddressList = [...ignoredAddressList];
  ignoredTokenIdList = [...ignoredTokenIdList];
  // ToDo
  const currentUnixTime = Math.floor(new Date().getTime() / 1e3);
  // 14 days before
  const startInvivationDateUnix = currentUnixTime - 14 * 24 * 60 * 60;
  // 7 days before
  const startGameDateUnix = currentUnixTime - 7 * 24 * 60 * 60;

  const [invivationLogs, gameLogs] = await Promise.all([
    getInvivationTransferLogs(startInvivationDateUnix, currentUnixTime),
    getGameRevealedLogs(startGameDateUnix, currentUnixTime),
  ]);

  const invitedBy: { [to: string]: string } = {};
  const battleMap: { [address: string]: number } = {};
  for (const { from, to, tokenId } of invivationLogs) {
    if (from !== zeroAddress && to !== zeroAddress) {
      if (!ignoredAddressList.includes(to) && !ignoredTokenIdList.includes(tokenId.hex)) {
        if (invitedBy[to]) {
          // ここのエラーは起きないはず
          throw new Error('already invited by ' + invitedBy[to]);
        }
        invitedBy[to] = from;
        ignoredAddressList.push(to);
        ignoredTokenIdList.push(tokenId.hex);
      }  
    }
  }
  for (const { maker, challenger } of gameLogs) {
    if (invitedBy[maker]) {
      if (battleMap[invitedBy[maker]]) {
        battleMap[invitedBy[maker]]++;
      } else {
        battleMap[invitedBy[maker]] = 1;
      }
    }
    if (invitedBy[challenger]) {
      if (battleMap[invitedBy[challenger]]) {
        battleMap[invitedBy[challenger]]++;
      } else {
        battleMap[invitedBy[challenger]] = 1;
      }
    }
  }
  // console.log(ignoredAddressList);
  // console.log(ignoredTokenIdList);
  // console.log(battles);
  const battles: { address: string; battles: number }[] = [];
  for (const address in battleMap) {
    battles.push({ address, battles: battleMap[address] })
  }
  return { ignoredAddressList, ignoredTokenIdList, battles };
};

// calcLatest7DaysResult()
//   .then((res) => console.log(res));
// calcInvitationEffect([], [])
//   .then((res) => console.log(res));
