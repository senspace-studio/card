import { zeroAddress } from 'viem';
import { getGameRevealedLogs } from './batch';
import { S3 } from 'aws-sdk';
import { S3_BACKET_NAME } from './config';

const s3 = new S3();

export const handler = async () => {
  const currentUnixTime = Math.floor(new Date().getTime() / 1e3);

  const startDateUnix = currentUnixTime - 7 * 24 * 60 * 60;
  const logs = await getGameRevealedLogs(startDateUnix, currentUnixTime);
  const resultJson: {
    [address: string]: { win: number; lose: number; draw: number };
  } = {};
  const init = (address: string) => {
    if (!resultJson[address]) {
      resultJson[address] = { win: 0, lose: 0, draw: 0 };
    }
  };

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
  const result: { address: string; win: number; lose: number; draw: number }[] =
    [];
  for (const address in resultJson) {
    if (address !== zeroAddress) {
      result.push({ address, ...resultJson[address] });
    }
  }

  if (S3_BACKET_NAME) {
    const params = {
      Bucket: S3_BACKET_NAME,
      Key: `calcLast7DaysResult/result.json`,
      Body: JSON.stringify({ result, updatedAt: currentUnixTime }),
      ContentType: 'application/json',
    };
    try {
      await s3.putObject(params).promise();
    } catch (error) {
      console.error(error);
    }
  }
};
