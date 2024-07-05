import 'dotenv/config';
import { API_ENDPOINT, STACK_ALGORITHM } from "./config";
import { IndividualStackData } from './type';
import { Address } from 'viem';
import { uploadS3 } from './utils/s3';

export const handler = async (year: number, month: number, day: number) => {
  const startdate = Math.floor(Date.UTC(year, month - 1, day - 1, 3) / 1e3);
  const enddate = startdate + (24 * 60 * 60);
  const res = await fetch(`${API_ENDPOINT}/points/calcurate-score?end_date_unix=${enddate}`);
  const resData = (await res.json()) as [Address, number][];
  const algorithm = STACK_ALGORITHM;
  const data: IndividualStackData = {
    // '2024/07/03'
    date: `${year}/${`00${month + 1}`.slice(-2)}/${`00${day}`.slice(-2)}`,
    algorithm, // 'HC-01'
    data: [],
  };
  // const scores: { [address: string]: number; } = {};
  for (const [address, score] of resData) {
    data.data.push({ address, score });
  }
  // ToDo: ファイル名変更
  await uploadS3(
    data,
    // individual_stack_data/2024-07-01.json
    `individual_stack_data/${year}-${`00${month}`.slice(-2)}-${`00${day}`.slice(-2)}.json`,
  );
}
