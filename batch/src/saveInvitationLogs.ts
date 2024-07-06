import 'dotenv/config';
import { degenClient, getInvivationTransferLogs } from './batch';
import { InvitationTransferData } from './type';
import { Address } from 'viem';
import { uploadS3 } from './utils/s3';

/**
 * 3 AM UTCを基準に過去23:59:59 の実績を参照
 * @param year (2024)年
 * @param month (7)月
 * @param day (1)日
 */
export const handler = async (year: number, month: number, day: number) => {
  const startdate = Math.floor(Date.UTC(year, month - 1, day - 1, 3) / 1e3);
  const enddate = startdate + (24 * 60 * 60);
  const datas: InvitationTransferData[] = [];
  const logs = await getInvivationTransferLogs(startdate, enddate);
  const timestampMap: { [blockNumber: string]: string } = {};
  for (const log of logs) {
    const blockNumber = log.transaction.blockNumber as number;
    if (!timestampMap[`${blockNumber}`]) {
      for (let i = 0; i < 50; i++) {
        try {
          const block = await degenClient.getBlock({ blockNumber: BigInt(blockNumber) });
          timestampMap[blockNumber] = new Date(Number(block.timestamp) * 1e3).toISOString();
          break;
        } catch (error) {
          console.log(`api error count ${i}`);
        }
      }
    }

    const inviter = log.data.from as Address;
    const invitee = log.data.to as Address;
    const tokenId = Number(log.data.tokenId.hex);
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
    datas,
    `invite/${year}${`00${month}`.slice(-2)}${`00${day}`.slice(-2)}.json`,
  );
}
// handler(2024, 6, 25);
