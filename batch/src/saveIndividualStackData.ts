import 'dotenv/config';
import { API_ENDPOINT, STACK_ALGORITHM } from './config';
import { IndividualStackData } from './type';
import { Address } from 'viem';
import { uploadS3 } from './utils/s3';
import { sendErrorNotification } from './utils/ifttt';
import dayjs from 'dayjs';

export const handler = async (year: number, month: number, day: number) => {
  try {
    const startdate = Math.floor(Date.UTC(year, month - 1, day - 1, 3) / 1e3);
    const enddate = startdate + 24 * 60 * 60;
    const res = await fetch(
      `${API_ENDPOINT}/points/calcurate-score?end_date_unix=${enddate * 1e3}`,
    );
    const resData = (await res.json()) as [Address, number][];
    const algorithm = STACK_ALGORITHM;
    const data: IndividualStackData = {
      date: `${dayjs(startdate * 1e3).format('YYYY-MM-DD')}`,
      algorithm, // 'HC-01'
      data: [],
    };

    for (const [address, score] of resData) {
      data.data.push({ address, score });
    }

    await uploadS3(
      data,
      `individualStack/${year}${`00${month}`.slice(-2)}${`00${day}`.slice(
        -2,
      )}.json`,
    );
  } catch (error: any) {
    console.error(error);
    await sendErrorNotification(error);
  }
};
// handler(2024, 6, 25);
