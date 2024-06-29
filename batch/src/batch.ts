import 'dotenv/config';
import { zeroAddress } from 'viem';
import tweClient from './thirdweb-engine';
import { INVITATION_CONTRACT_ADDRESS, WAR_CONTRACT_ADDRESS } from './config';
import { S_VIP_ADDRESSES } from './constants/vip';

export type GameRevealedEventLog = {
  gameId: string;
  maker: string;
  challenger: string;
  winner: string;
};

export type TransferEventLog = {
  from: string;
  to: string;
  tokenId: { type: string; hex: string };
  blockNumber: number;
};

const getBlockNumberFromTimestamp = async (timestamp: number) => {
  const res = await fetch(
    `https://explorer.degen.tips/api?module=block&action=getblocknobytime&timestamp=${timestamp}&closest=after`,
  );
  const {
    result: { blockNumber },
  } = (await res.json()) as { result: { blockNumber: string } };
  return blockNumber;
};

const getContractEventLogs = async <E>(
  contractAddress: string,
  eventName: string,
  startDateUnix: number,
  endDateUnix: number,
) => {
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

  const {
    result,
  }: {
    result: {
      eventName: string;
      data: any;
      transaction: any;
    }[];
  } = res.data;

  return result;
};

export const getGameRevealedLogs = async (
  startDateUnix: number,
  endDateUnix: number,
) => {
  const allLogs = await getContractEventLogs(
    WAR_CONTRACT_ADDRESS,
    'GameRevealed',
    startDateUnix,
    endDateUnix,
  );

  return allLogs.map((log) => log.data) as GameRevealedEventLog[];
};

export const getInvivationTransferLogs = async (
  startDateUnix: number,
  endDateUnix: number,
  lastLogs: TransferEventLog[],
) => {
  const allLogs = await getContractEventLogs<TransferEventLog>(
    INVITATION_CONTRACT_ADDRESS,
    'Transfer',
    startDateUnix,
    endDateUnix,
  );

  const uniqueTransferLogs = new Map<number, TransferEventLog>();

  for (const lastLog of lastLogs) {
    uniqueTransferLogs.set(Number(lastLog.tokenId.hex), lastLog);
  }

  for (const log of allLogs) {
    if (
      log.data.from !== zeroAddress &&
      log.data.to !== zeroAddress &&
      !S_VIP_ADDRESSES.includes(log.data.to.toLowerCase()) &&
      (!uniqueTransferLogs.has(log.data.tokenId.hex) ||
        log.transaction.blockNumber <
          Number(
            uniqueTransferLogs.get(log.data.tokenId.hex)?.blockNumber || 0,
          ))
    ) {
      uniqueTransferLogs.set(log.data.tokenId.hex, {
        from: log.data.from,
        to: log.data.to,
        tokenId: log.data.tokenId.hex,
        blockNumber: log.transaction.blockNumber,
      });
    }
  }

  const logs = Array.from(uniqueTransferLogs.values())
    .sort((a, b) => a.blockNumber - b.blockNumber)
    .filter(
      (log, index, self) => index === self.findIndex((l) => l.to === log.to),
    );

  return logs as TransferEventLog[];
};
