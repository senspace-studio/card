import 'dotenv/config';
import { Chain, createPublicClient, http, zeroAddress } from 'viem';
import { degen } from 'viem/chains';
import tweClient from './thirdweb-engine';
import { BLOCKCHAIN_API_DEGEN, INVITATION_CONTRACT_ADDRESS, WAR_CONTRACT_ADDRESS } from './config';

export const degenClient = createPublicClient({
  chain: { ...degen, fees: { baseFeeMultiplier: 1.25 } } as Chain,
  transport: http(BLOCKCHAIN_API_DEGEN),
});


type GameRevealedEventLog = {
  gameId: string;
  maker: string;
  challenger: string;
  winner: string;
};

type TransferEventLog = {
  from: string;
  to: string;
  tokenId: { type: string; hex: string };
};

const getBlockNumberFromTimestamp = async (timestamp: number, closest: 'before' | 'after') => {
  const res = await fetch(
    `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=${closest}`,
  );
  const resJson = (await res.json()) as { result: { blockNumber: string } };
  console.log(resJson);
  const { result: { blockNumber } } = resJson;
  return blockNumber;
};

const getContractEventLogs = async <E>(
  contractAddress: string,
  eventName: string,
  startDateUnix: number,
  endDateUnix: number,
) => {
  const [fromBlock, toBlock] = await Promise.all([
    getBlockNumberFromTimestamp(startDateUnix, 'after'),
    getBlockNumberFromTimestamp(endDateUnix, 'before'),
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
  const {
    result,
  }: {
    result: {
      eventName: string;
      data: E;
      transaction: any;
    }[];
  } = res.data;
  // 古いログが小さいインデックス
  return result.reverse().map((r) => ({ ...r })) as unknown as {
    eventName: string;
    data: E;
    transaction: any;
    // transaction: {
    //   blockNumber: 23244908,
    //   blockHash: '0x1fe272bc8733648cf8f7e51fb6acde0cf102827dca6e21b4a627459a71946ac1',
    //   transactionIndex: 1,
    //   removed: false,
    //   address: '0xedCB16F9abA99F564B02c8f37a138317583D11a8',
    //   data: '0x000000000000000000000000777ee5eeed30c3712bee6c83260d786857d9c556',
    //   topics: [
    //     '0xc1fa908c623b30abe36f5fe369b6a002b2afaacecc76d317fc070bdd87ea7969',
    //     '0xe18439095793214a000000000000000000000000000000000000000000000000',
    //     '0x000000000000000000000000dcb93093424447bf4fe9df869750950922f1e30b',
    //     '0x000000000000000000000000777ee5eeed30c3712bee6c83260d786857d9c556'
    //   ],
    //   transactionHash: '0x501fbf8d19804b5f49d25bd6a2aeecdd0f3a96b9d3b810ecba7aeb08b65448a2',
    //   logIndex: 3,
    //   event: 'GameRevealed',
    //   eventSignature: 'GameRevealed(bytes8,address,address,address)'
    // }
  }[];
};

export const getGameRevealedLogs = async (
  startDateUnix: number,
  endDateUnix: number,
) => {
  return await getContractEventLogs<GameRevealedEventLog>(
    WAR_CONTRACT_ADDRESS,
    'GameRevealed',
    startDateUnix,
    endDateUnix,
  );
};

export const getInvivationTransferLogs = async (
  startDateUnix: number,
  endDateUnix: number,
) => {
  return await getContractEventLogs<TransferEventLog>(
    INVITATION_CONTRACT_ADDRESS,
    'Transfer',
    startDateUnix,
    endDateUnix,
  );
};
