import { zeroAddress } from 'viem';
import { getGameRevealedLogs } from './batch';
import { uploadS3 } from './utils/s3';
import { EventBridgeInput } from './type';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { sendErrorNotification } from './utils/ifttt';

dayjs.extend(utc);

export const handler = async (event: EventBridgeInput) => {
  try {
    const endDate = dayjs(event.time)
      .utc()
      .set('hours', 3)
      .startOf('hours')
      .unix();

    const startDateUnix = endDate - 4 * 24 * 60 * 60;
    const logs = await getGameRevealedLogs(startDateUnix, endDate);
    const resultJson: {
      [address: string]: { win: number; lose: number; draw: number };
    } = {};
    const init = (address: string) => {
      if (!resultJson[address]) {
        resultJson[address] = { win: 0, lose: 0, draw: 0 };
      }
    };

    for (const {
      data: { maker, challenger, winner },
    } of logs) {
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
    const result: {
      address: string;
      win: number;
      lose: number;
      draw: number;
    }[] = [];
    for (const address in resultJson) {
      if (address !== zeroAddress) {
        result.push({ address, ...resultJson[address] });
      }
    }

    await uploadS3(
      { result, updatedAt: endDate },
      `calcLast4DaysResult/${dayjs(event.time).format('YYYY-MM-DD')}.json`,
    );
  } catch (error: any) {
    console.error(error);
    await sendErrorNotification('calcInvitationBattles', error);
  }
};
