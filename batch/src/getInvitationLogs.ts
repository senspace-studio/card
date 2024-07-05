import 'dotenv/config';
import { degenClient, getInvivationTransferLogs } from './batch';
import { InvitationTransferData } from './type';
import { Address } from 'viem';

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
  const datas: InvitationTransferData[] = [];
  const logs = await getInvivationTransferLogs(startdate, enddate);
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

    const inviter = log.data.from as Address;
    const invitee = log.data.to as Address;
    const tokenId = Number(log.data.tokenId.hex);
    console.log({
      inviter,
      invitee,
      tokenId,
      createdBlockNumber: blockNumber,
      createdAt: timestampMap[blockNumber],
    });
    datas.push({
      inviter,
      invitee,
      tokenId,
      createdBlockNumber: blockNumber,
      createdAt: timestampMap[blockNumber],
    });
  }
  // await uploadS3(
  //   logs,
  //   // invitation_data/2024-07-01.json
  //   `invitation_data/${year}-${`00${month}`.slice(-2)}-${`00${day}`.slice(-2)}.json`,
  // );
}
