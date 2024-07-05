import 'dotenv/config';
import { Address, zeroAddress } from 'viem';
import { degenClient, getGameRevealedLogs } from './batch';
import { BattleData } from './type';
import { uploadS3 } from './utils/s3';

/**
 * 
 * @param year (2024)年
 * @param month (7)月
 * @param day (1)日
 */
export const handler = async (year: number, month: number, day: number) => {
  const startdate = Math.floor(Date.UTC(year, month - 1, day) / 1e3);
  const enddate = startdate + (24 * 60 * 60);
  console.log(startdate, enddate);
  const datas: BattleData[] = [];
  const logs = await getGameRevealedLogs(startdate, enddate);
  const timestampMap: { [blockNumber: string]: string } = {};
  for (const log of logs) {
    const blockNumber = log.transaction.blockNumber as number;
    if (!timestampMap[`${blockNumber}`]) {
      for (let i = 0; i < 50; i++) {
        try {
          const block = await degenClient.getBlock({ blockNumber: BigInt(blockNumber) });
          console.log(block.timestamp);
          timestampMap[blockNumber] = new Date(Number(block.timestamp) * 1e3).toISOString();
          break;
        } catch (error) {
          console.log(`api error count ${i}`);
        }
      }
    }
    const gameId = log.data.gameId;
    const maker = log.data.maker as Address;
    const challenger = log.data.challenger as Address;
    const winner = log.data.winner as Address;
    const loser = 
      winner === zeroAddress
      ? zeroAddress
      : winner === maker
      ? challenger : maker;
    const isDraw = winner === zeroAddress;
    console.log({
      gameId,
      maker,
      challenger,
      winner,
      loser,
      isDraw,
      createdBlockNumber: blockNumber,
      createdAt: timestampMap[blockNumber],
    });
    datas.push({
      gameId,
      maker,
      challenger,
      winner,
      loser,
      isDraw,
      createdBlockNumber: blockNumber,
      createdAt: timestampMap[blockNumber],
    });
  }
  // await uploadS3(
  //   logs,
  //   // battle_data/2024-07-01.json
  //   `battle_data/${year}-${`00${month}`.slice(-2)}-${`00${day}`.slice(-2)}.json`,
  // );
}
handler(2024, 6, 24);