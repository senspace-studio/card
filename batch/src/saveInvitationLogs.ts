import 'dotenv/config';
import {
  degenClient,
  getInvivationTransferLogs,
  TransferEventLog,
} from './batch';
import { EventBridgeInput, InvitationTransferData } from './type';
import { Address } from 'viem';
import { getFileFromS3, uploadS3 } from './utils/s3';
import { sendErrorNotification } from './utils/ifttt';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);

export const handler = async (event: EventBridgeInput) => {
  try {
    const endDate = dayjs(event.time)
      .utc()
      .set('hours', 3)
      .startOf('hours')
      .unix();
    const startDate = endDate - 24 * 60 * 60;
    const datas: InvitationTransferData[] = [];

    const lastFile = await getFileFromS3('calcInvitationBattles/result.json');
    const lastInvitations: TransferEventLog[] = lastFile
      ? lastFile.invivations
      : [];

    const logs = await getInvivationTransferLogs(
      startDate,
      endDate,
      lastInvitations,
    );
    const timestampMap: { [blockNumber: string]: string } = {};

    for (const log of logs) {
      const blockNumber = log.blockNumber as number;
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

      const inviter = log.from as Address;
      const invitee = log.to as Address;
      const tokenId = Number(log.tokenId.hex);
      const info = {
        inviter,
        invitee,
        tokenId,
        createdBlockNumber: blockNumber,
        createdAt: timestampMap[blockNumber],
      };
      datas.push(info);
    }
    // console.log(datas);
    await uploadS3(
      { datas, startDate, endDate },
      `invite/${dayjs(startDate * 1e3).format('YYYY-MM-DD')}.json`,
    );
  } catch (error: any) {
    console.error(error);
    await sendErrorNotification('SaveInvitationLogs', error);
  }
};
// handler(2024, 6, 25);
