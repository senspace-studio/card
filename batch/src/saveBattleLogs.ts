import 'dotenv/config';
import { Address, zeroAddress } from 'viem';
import { degenClient, getGameRevealedLogs } from './batch';
import { BattleData, EventBridgeInput } from './type';
import { uploadS3 } from './utils/s3';
import { sendErrorNotification } from './utils/ifttt';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

/**
 * 3 AM UTCを基準に過去23:59:59 の実績を参照
 */
export const handler = async (event: EventBridgeInput) => {
  try {
    const endDate = dayjs(event.time)
      .utc()
      .set('hours', 3)
      .startOf('hours')
      .unix();
    const startDate = endDate - 24 * 60 * 60;
    const datas: BattleData[] = [];
    const logs = await getGameRevealedLogs(startDate, endDate);
    const timestampMap: { [blockNumber: string]: string } = {};
    for (const log of logs) {
      const blockNumber = log.transaction.blockNumber as number;
      if (!timestampMap[`${blockNumber}`]) {
        for (let i = 0; i < 10; i++) {
          try {
            const block = await degenClient.getBlock({
              blockNumber: BigInt(blockNumber),
            });
            timestampMap[blockNumber] = new Date(
              Number(block.timestamp) * 1e3,
            ).toISOString();
            break;
          } catch (error) {
            if (i === 9) {
              throw new Error('Block Number api error');
            }
            console.log(`api error count ${i}`);
            await new Promise((resolve) => setTimeout(resolve, 100));
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
          ? challenger
          : maker;
      const isDraw = winner === zeroAddress;
      const info = {
        gameId,
        maker,
        challenger,
        winner,
        loser,
        isDraw,
        createdBlockNumber: blockNumber,
        createdAt: timestampMap[blockNumber],
      };
      datas.push(info);
    }

    await uploadS3(
      { data: datas, startDate, endDate },
      `battle/${dayjs(startDate * 1e3).format('YYYY-MM-DD')}.json`,
    );
  } catch (error: any) {
    console.error(error);
    await sendErrorNotification('SaveBattleLogs', error);
  }
};
